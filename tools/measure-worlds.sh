#!/bin/bash
# Измерение стоимости мира: только настоящий процесс сервера (tsx поднимает
# дочерний node — меряем именно его), миры слушают 127.0.0.1, без игроков.
cd /home/user/tg_bot || exit 1
export DATABASE_URL=postgres://tdl:tdl@127.0.0.1:55432/tdl
export SESSION_SECRET=measure-secret-0123456789
export ADMIN_TOKEN=dev-admin-key-42
export NODE_ENV=production
export WORLD_SEED=1541
export WORLD_SIZE=200
export ACCESS_MODE=admins
export ADMIN_LOGINS=garry
N=${1:-5}
START=${2:-1}
PIDS=()
for i in $(seq "$START" "$((START + N - 1))"); do
  PORT=$((3300 + i)) WORLD_ID="m$i" HOST=127.0.0.1 node_modules/.bin/tsx apps/server/src/index.ts >/tmp/world-$i.log 2>&1 &
  PIDS+=($!)
done
sleep 20
echo "миров поднялось: $(grep -l 'boot.ready' /tmp/world-*.log 2>/dev/null | wc -l) из $N"
# Настоящие процессы сервера: дочерние у tsx.
REAL=()
for p in "${PIDS[@]}"; do
  C=$(pgrep -P "$p" | head -1)
  [ -n "$C" ] && REAL+=("$C")
done
TOTAL=0
for p in "${REAL[@]}"; do
  R=$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ')
  if [ -n "$R" ]; then TOTAL=$((TOTAL + R)); fi
done
COUNT=${#REAL[@]}
if [ "$COUNT" -gt 0 ]; then
  echo "память: суммарно $((TOTAL / 1024)) МБ на $COUNT процессов, по $((TOTAL / 1024 / COUNT)) МБ на мир"
fi
declare -A BEFORE
for p in "${REAL[@]}"; do BEFORE[$p]=$(awk '{print $14+$15}' /proc/"$p"/stat 2>/dev/null); done
sleep 30
HZ=$(getconf CLK_TCK)
for p in "${REAL[@]}"; do
  A=$(awk '{print $14+$15}' /proc/"$p"/stat 2>/dev/null)
  B=${BEFORE[$p]}
  if [ -n "$A" ] && [ -n "$B" ]; then
    echo "  pid $p: в покое $(awk -v t=$((A - B)) -v hz="$HZ" 'BEGIN{printf "%.1f", t/hz/30*100}')% ядра"
  fi
done
node -e '
const pg = require("/home/user/tg_bot/node_modules/.pnpm/pg@8.23.0/node_modules/pg");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1", ["tdl-host"]))
  .then((r) => { console.log("соединений к базе от миров сейчас:", r.rows[0].n); return c.end(); });
'
for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
sleep 3
echo "миры остановлены"
