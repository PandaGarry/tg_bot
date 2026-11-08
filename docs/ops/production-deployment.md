# Production deployment: TLS, reverse proxy и Node.js

> **Статус:** reference runbook, не production deployment. Пример рассчитан на один Linux host с Nginx на том же узле и PostgreSQL вне приложения. Реальные адреса, сертификаты, firewall, proxy peer IP, DB provider и secrets должны быть заданы оператором. До проверки на выбранном хостинге AUD-035 остаётся частично открытым.

## 1. Схема и границы доверия

```text
Browser -- HTTPS/WSS :443 --> Nginx -- HTTP/WS loopback --> TDL :3000
                                      |
                                      +--> PostgreSQL provider (TLS)
```

- Публично доступны только 80/443 на Nginx. Node слушает `127.0.0.1:3000`; порт 3000 не публикуется наружу.
- TLS завершается на Nginx. Nginx обязан сохранять `Host`, `Origin`, WebSocket Upgrade и передавать XFF цепочку.
- PostgreSQL не должен принимать соединения из публичного интернета; разрешить только адрес/сеть приложения и требовать TLS при удалённом подключении.
- `ALLOWED_ORIGINS` — точный HTTPS origin браузера, без пути и завершающего слэша.
- `TRUSTED_PROXY_IPS` — адреса непосредственных TCP peers, которые Node действительно видит. Для Nginx на том же host с upstream `127.0.0.1` это обычно `127.0.0.1`; добавляй `::1` только если Node реально принимает соединение от IPv6 loopback. Не указывай диапазоны: конфиг принимает только точные IP.
- Не доверяй XFF от произвольных адресов. Парсер TDL использует XFF только если непосредственный peer есть в `TRUSTED_PROXY_IPS`, затем проходит цепочку справа налево через доверенные hops.

## 2. Production environment

Создай отдельного системного пользователя и root-owned env file вне репозитория, например `/etc/tdl/tdl.env` с правами `0600`. Не помещай секреты в Git, unit file, URL публичных ссылок или клиентскую сборку.

Обязательные значения:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000

WORLD_ID=deadlands-01
WORLD_NAME=The Dead Lords
WORLD_SEED=1541
WORLD_SIZE=200

DATABASE_URL=postgresql://<user>:<password>@<db-host>:5432/<db>?sslmode=require
SESSION_SECRET=<unique-random-secret-at-least-32-characters>
ADMIN_TOKEN=<different-unique-random-secret-at-least-32-characters>

ALLOWED_ORIGINS=https://game.example.com
TRUSTED_PROXY_IPS=127.0.0.1

ACCESS_MODE=public
ADMIN_LOGINS=
REGISTRATION_OPEN=0
PG_POOL_MAX=2
COMMAND_RATE=20
```

Сгенерируй два разных секрета, например двумя отдельными вызовами `openssl rand -base64 48`. Не используй демонстрационные значения выше. Если Nginx/Node находятся на разных узлах, замени `TRUSTED_PROXY_IPS` точными адресами proxy peers, наблюдаемыми Node. Если proxy не нужен, не добавляй выдуманные адреса: XFF останется недоверенным, и IP rate limiting будет опираться на TCP peer.

Перед открытием регистрации проверь DNS, сертификат, firewall, DB connectivity, резервные копии и operator access. Для первого запуска оставь `REGISTRATION_OPEN=0`.

## 3. Nginx reference config

Файл `/etc/nginx/conf.d/tdl.conf`. Замени домен и пути сертификатов. `map` должен находиться в контексте `http`, как в стандартном `conf.d` include.

```nginx
map $http_upgrade $tdl_connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name game.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name game.example.com;

    ssl_certificate     /etc/letsencrypt/live/game.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:TDL_TLS:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location /socket {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $tdl_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Если установлен Nginx старой версии, которая не понимает `http2 on;`, используй поддерживаемую этой версией форму `listen 443 ssl http2;`. Не включай HSTS до проверки корректного HTTPS для всего домена и поддоменов.

## 4. systemd service reference

Пример `/etc/systemd/system/tdl.service`:

```ini
[Unit]
Description=The Dead Lords game server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tdl
Group=tdl
WorkingDirectory=/opt/tdl
EnvironmentFile=/etc/tdl/tdl.env
ExecStart=/usr/bin/node /opt/tdl/tools/start-production.mjs
Restart=on-failure
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=20
LimitNOFILE=65535
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Путь к Node 24 уточни командой `command -v node`; `ExecStart` должен указывать на него. Деплой выполняй в `/opt/tdl` от отдельного пользователя/CI, а runtime-пользователю оставь чтение артефакта и env. Проверить совместимость systemd sandboxing с выбранным хостом до включения в production.

## 5. Deploy и smoke checklist

1. Установить Node.js 24 и pnpm версии из `package.json`.
2. Получить код на утверждённый release commit; выполнить `pnpm install --frozen-lockfile`.
3. Выполнить `pnpm typecheck`, `pnpm test`, `pnpm check`, `pnpm build`.
4. Проверить, что production DB backup снят и restore-процедура доступна.
5. Проверить env file permissions, уникальные secrets, `WORLD_ID`, точный `ALLOWED_ORIGINS` и `TRUSTED_PROXY_IPS`.
6. Проверить `sudo nginx -t`, затем перезагрузить Nginx и включить systemd unit.
7. Проверить локально `curl -fsS http://127.0.0.1:3000/api/health`: ожидается только `ok` и `ready`.
8. Проверить публично HTTPS, сертификат и редирект с HTTP; `GET /api/ops/health` и `GET /api/schedule` без токена должны возвращать 403.
9. Проверить WebSocket на `wss://game.example.com/socket` с `Origin: https://game.example.com`; запрос без Origin и с чужим Origin должен быть отклонён.
10. Проверить логи старта/миграций, DB pool saturation, рестарт и graceful shutdown. Только после этого открывать регистрацию отдельным изменением.

## 6. Rollback и ограничения

- Перед миграциями — backup. Не выполнять автоматический `pg_restore --clean` поверх рабочей базы.
- Откат приложения не означает откат схемы. Для schema rollback нужна отдельная проверенная миграция или восстановление в новую изолированную БД.
- Следить за сроком TLS сертификата, доступностью DB, диском, памятью, рестартами, соединениями и сроком резервных копий.
- Этот шаблон не доказывает, что выбранный хостинг/провайдер действительно выдаёт указанные proxy IP, TLS и backup guarantees. Зафиксировать реальные параметры после выбора платформы и выполнить deployment drill на ней.

**Приёмка AUD-035:** production domain и TLS валидны; Node недоступен напрямую; Origin allowlist работает; XFF доверяется только фактическому proxy peer; health/schedule/ops endpoints защищены согласно назначению; WSS проходит; restart/shutdown и миграции проверены на целевом хостинге.
