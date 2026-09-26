#!/bin/bash
# Ёмкость узла: N миров боевой сборкой на одном узле. Миры слушают 127.0.0.1,
# вход открыт только служебным логинам. Считаем запуск, память, процессор в покое
# и соединения к базе.
cd /home/user/tg_bot || exit 1
export DATABASE_URL=postgres://tdl:tdl@127.0.0.1:55432/tdl
export SESSION_SECRET=measure-secret-0123456789
export NODE_ENV=production
export WORLD_SEED=1541
export WORLD_SIZE=200
export ACCESS_MODE=admins
export ADMIN_LOGINS=garry
export PG_POOL_MAX=${3:-2}
N=${1:-30}
START=${2:-100}
PIDS=()
for i in $(seq "$START" "$((START + N - 1))"); do
  PORT=$((3500 + i)) WORLD_ID="cap$i" HOST=127.0.0.1 node apps/server/dist/index.mjs >>/tmp/cap.log 2>&1 &
  PIDS+=($!)
done
# Ждём, пока все ответят: запуск считается по последнему.
DEADLINE=$((SECONDS + 90))
UP=0
for i in $(seq "$START" "$((START + N - 1))"); do
  PORT=$((3500 + i))
  while [ "$SECONDS" -lt "$DEADLINE" ]; do
    if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/api/health"; then break; fi
    sleep 0.3
  done
done
for i in $(seq "$START" "$((START + N - 1))"); do
  PORT=$((3500 + i))
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/api/health"; then UP=$((UP + 1)); fi
done
echo "миров поднялось: $UP из $N (пул соединений на мир: $PG_POOL_MAX)"
TOTAL=0
for p in "${PIDS[@]}"; do
  R=$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ')
  if [ -n "$R" ]; then TOTAL=$((TOTAL + R)); fi
done
[ "$UP" -gt 0 ] && echo "память: суммарно $((TOTAL / 1024)) МБ, по $((TOTAL / 1024 / UP)) МБ на мир"
declare -A BEFORE
for p in "${PIDS[@]}"; do BEFORE[$p]=$(awk '{print $14+$15}' /proc/"$p"/stat 2>/dev/null); done
sleep 30
HZ=$(getconf CLK_TCK)
SUM=0
for p in "${PIDS[@]}"; do
  A=$(awk '{print $14+$15}' /proc/"$p"/stat 2>/dev/null)
  B=${BEFORE[$p]}
  if [ -n "$A" ] && [ -n "$B" ]; then SUM=$((SUM + A - B)); fi
done
echo "процессор в покое: $(awk -v t="$SUM" -v hz="$HZ" 'BEGIN{printf "%.1f", t/hz/30*100}')% одного ядра на все миры"
node -e '
const pg = require("/home/user/tg_bot/node_modules/.pnpm/pg@8.23.0/node_modules/pg");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1", ["tdl-host"]))
  .then((r) => { console.log("соединений к базе:", r.rows[0].n); return c.end(); });
'
for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
sleep 4
echo "миры остановлены"
