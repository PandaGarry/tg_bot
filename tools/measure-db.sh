#!/bin/bash
# Запись в базу под нагрузкой: сколько строк и транзакций Postgres уходит на
# команду и сколько процессора тратят мир и база.
#   bash tools/measure-db.sh [сессий] [команд на сессию]
cd /home/user/tg_bot || exit 1
export DATABASE_URL=postgres://tdl:tdl@127.0.0.1:55432/tdl
export SESSION_SECRET=measure-secret-0123456789
export NODE_ENV=production
export WORLD_SEED=1541
export WORLD_SIZE=200
export ACCESS_MODE=public
export REGISTRATION_OPEN=1
export COMMAND_RATE=500
export PG_POOL_MAX=4
SESSIONS=${1:-80}
COMMANDS=${2:-40}

PORT=3406 WORLD_ID=db1 HOST=127.0.0.1 nohup node apps/server/dist/index.mjs >/tmp/db1.log 2>&1 &
sleep 6

stat_line() {
  node -e '
const pg = require("/home/user/tg_bot/node_modules/.pnpm/pg@8.23.0/node_modules/pg");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT xact_commit::bigint c, tup_inserted::bigint i, tup_updated::bigint u, tup_deleted::bigint d FROM pg_stat_database WHERE datname = current_database()"))
  .then((r) => { const x = r.rows[0]; console.log(JSON.stringify({ c: Number(x.c), i: Number(x.i), u: Number(x.u), d: Number(x.d) })); return c.end(); });
'
}

BEFORE=$(stat_line)
WID=$(pgrep -f "dist/index.mjs" | tail -1)
PGPID=$(pgrep -f "bin/postgres -D" | head -1)
HZ=$(getconf CLK_TCK)
cpu() { awk '{print $14+$15}' /proc/"$1"/stat 2>/dev/null; }
W_BEFORE=$(cpu "$WID")
PG_BEFORE=0
[ -n "$PGPID" ] && PG_BEFORE=$(cpu "$PGPID")

START=$(date +%s%N)
timeout 300 corepack pnpm exec tsx tools/load/index.ts --url ws://127.0.0.1:3406/socket --sessions "$SESSIONS" --commands "$COMMANDS" 2>&1 | sed -n '1,4p'
ELAPSED=$(( ($(date +%s%N) - START) / 1000000 ))

W_AFTER=$(cpu "$WID")
PG_AFTER=0
[ -n "$PGPID" ] && PG_AFTER=$(cpu "$PGPID")
AFTER=$(stat_line)

echo "было:  $BEFORE"
echo "стало: $AFTER"
node -e '
const [beforeRaw, afterRaw, commands, wBefore, wAfter, pgBefore, pgAfter, elapsed, hz] = process.argv.slice(1);
const before = JSON.parse(beforeRaw);
const after = JSON.parse(afterRaw);
const n = Number(commands);
const per = (key) => ((after[key] - before[key]) / n).toFixed(2);
console.log(`на команду: транзакций ${per("c")}, вставок ${per("i")}, правок ${per("u")}, удалений ${per("d")}`);
console.log(`строк за прогон: ${(after.i - before.i) + (after.u - before.u) + (after.d - before.d)} на ${n} команд`);
const share = (delta) => (((delta / Number(hz)) * 1000 / Number(elapsed)) * 100).toFixed(0);
console.log(`процессор мира: ${((Number(wAfter) - Number(wBefore)) / Number(hz)).toFixed(2)} с за ${(Number(elapsed) / 1000).toFixed(1)} с (${share(Number(wAfter) - Number(wBefore))}% ядра)`);
if (Number(pgAfter) > 0) {
  console.log(`процессор базы: ${((Number(pgAfter) - Number(pgBefore)) / Number(hz)).toFixed(2)} с за ${(Number(elapsed) / 1000).toFixed(1)} с (${share(Number(pgAfter) - Number(pgBefore))}% ядра)`);
}
' "$BEFORE" "$AFTER" "$((SESSIONS * COMMANDS))" "$W_BEFORE" "$W_AFTER" "$PG_BEFORE" "$PG_AFTER" "$ELAPSED" "$HZ"

ps -o rss= -p "$WID" | awk '{printf "память мира: %.0f МБ\n", $1/1024}'
kill "$WID" 2>/dev/null
sleep 2
echo "мир остановлен"
