# Backup и restore drill PostgreSQL

> **Статус:** инструменты и регламент подготовлены. Фактический backup/restore drill на целевой production-like базе ещё не выполнялся; AUD-034 остаётся P0 и не считается закрытым.

## Цель и границы

- Снимать PostgreSQL dump в custom format через `pg_dump`.
- Проверять архив через `pg_restore --list` и SHA-256.
- Хранить dump вне Git-репозитория, с закрытыми правами.
- Восстанавливать только в отдельную пустую БД с именем `tdl_restore_*`.
- Никогда не выполнять restore поверх исходной или production-БД.
- Не записывать `DATABASE_URL`, пароли и токены в metadata, журналы или Git.

Скрипты:
- `tools/db/backup.sh` — создание и первичная проверка dump.
- `tools/db/restore-drill.sh` — проверка checksum, восстановление в изолированную БД и smoke check таблиц `worlds`/ `module_states`.

## Требования

На операционной машине нужны `pg_dump`, `pg_restore`, `psql`, `sha256sum` и Bash.

Перед production необходимо выбрать у провайдера:
- автоматические резервные копии и, если доступны, point-in-time recovery;
- retention policy;
- целевые RPO/RTO;
- отдельное зашифрованное место хранения копии вне хоста приложения.

Custom dump не содержит роли PostgreSQL и глобальные настройки кластера. Роли и права должны восстанавливаться инфраструктурной конфигурацией, а не копированием секретов в dump.

## 1. Создать backup

Задай `DATABASE_URL` через secret manager или защищённую переменную окружения. Не вставляй реальный URL в команды, которые сохраняются в shell history.

```bash
export DATABASE_URL='postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require'
export TDL_BACKUP_DIR="$HOME/tdl-backups"
bash tools/db/backup.sh
```

Скрипт:
1. Откажется писать backup внутрь Git-репозитория.
2. Создаст каталог с правами `0700`.
3. Снимет dump в формате PostgreSQL custom с `--no-owner --no-acl`.
4. Проверит читаемость TOC через `pg_restore --list`.
5. Создаст SHA-256 и metadata без адреса БД и credentials.
6. Установит права `0600` на dump, checksum и metadata.

Путь к dump и checksum скрипт выведет в конце. Сохрани оба файла вместе с `.meta`.

## 2. Проверить и вынести копию

```bash
cd "$TDL_BACKUP_DIR"
sha256sum -c '<имя-dump>.sha256'
pg_restore --list '<имя-dump>' >/dev/null
```

Скопируй dump, checksum и metadata в отдельное зашифрованное хранилище. Не считай копию на том же диске или том же хосте полноценной disaster-recovery копией. Не добавляй dump в Git, Project files или обычные незашифрованные артефакты CI.

## 3. Подготовить изолированную БД для drill

Создай **новую пустую** PostgreSQL database, например `tdl_restore_20261108`, с пользователем, которому разрешены создание схемы и таблиц. Не используй имя исходной БД.

Не запускай `pg_restore --clean`, `DROP DATABASE` или команды очистки исходной БД. Скрипт восстановления намеренно не умеет удалять объекты.

## 4. Выполнить restore drill

```bash
export DATABASE_URL='postgresql://<source-user>:<source-password>@<source-host>:5432/<source-db>?sslmode=require'
export TDL_BACKUP_FILE="$HOME/tdl-backups/<имя-dump>.dump"
export TDL_RESTORE_DATABASE_URL='postgresql://<restore-user>:<restore-password>@<restore-host>:5432/tdl_restore_20261108?sslmode=require'
export TDL_RESTORE_CONFIRM='RESTORE_TO_ISOLATED_DATABASE'
bash tools/db/restore-drill.sh
```

Скрипт:
- требует явное подтверждение;
- проверяет, что target database отличается от source и имя начинается с `tdl_restore_`;
- проверяет SHA-256 и TOC dump;
- отказывается продолжать, если в target уже есть пользовательские таблицы;
- выполняет restore одной транзакцией без owner/ACL;
- проверяет наличие `public.worlds` и `public.module_states`, а также наличие хотя бы одного мира.

Он не создаёт target database, не удаляет её и не перезаписывает существующие таблицы.

## 5. Приёмка drill

AUD-034 можно закрыть только после того, как зафиксированы все пункты:

- [ ] Backup снят с актуальной production-like PostgreSQL.
- [ ] SHA-256 совпал; `pg_restore --list` прочитал архив.
- [ ] Копия вынесена в отдельное зашифрованное хранилище.
- [ ] Restore выполнен в новую изолированную БД с `tdl_restore_*`.
- [ ] Smoke check подтвердил core tables и восстановленный мир.
- [ ] Приложение успешно запущено против восстановленной копии в изолированной среде.
- [ ] Зафиксированы дата, версия `pg_dump`, hash, время backup/restore, число миров и module states, фактические RPO/RTO.
- [ ] Настроены provider-managed backups, retention и регулярное расписание проверки восстановления.

После проверки удали изолированную restore-БД средствами провайдера/оператора только после сохранения отчёта. Исходная БД этим runbook не изменяется.

## Ограничения

Подготовка скриптов не является доказательством восстановления. Пока нет выбранного production-провайдера и доступа к целевой БД, фактический drill выполнить нельзя; P0 AUD-034 остаётся открытым.
