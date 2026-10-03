#!/bin/bash
# Обработка целого каталога исходников: keyout + normalize.
#   set.sh <каталог с raw-*.png>  →  <каталог>/set/*.png
set -e
d="$1"
mkdir -p "$d/set"
for f in "$d"/raw-*.png; do
  n=$(basename "$f" .png); n=${n#raw-}
  /home/user/tg_bot/tools/uiart/keyout.sh "$f" "$d/set/$n.png"
  /home/user/tg_bot/tools/uiart/normalize.sh "$d/set/$n.png"
done
