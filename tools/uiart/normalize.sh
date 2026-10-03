#!/bin/bash
# Одинаковый визуальный вес набора: масштаб по «чернильной» площади (сумме альфы),
# а не по bounding box — иначе широкий знак выглядит крупнее компактного.
#
#   normalize.sh <файл 256×256> [доля площади, по умолчанию 0.30]
set -e
f="$1"; target="${2:-0.30}"
ink=$(convert "$f" -alpha extract -format '%[fx:mean]' info:)
k=$(awk -v i="$ink" -v t="$target" 'BEGIN{printf "%.4f", sqrt(t/i)}')
w=$(identify -format '%w' "$f"); h=$(identify -format '%h' "$f")
cap=$(awk -v w="$w" -v h="$h" -v k="$k" 'BEGIN{m=w; if(h>m)m=h; printf "%.4f", 236/(m*k)}')
kk=$(awk -v k="$k" -v c="$cap" 'BEGIN{if(c<1) printf "%.4f", k*c; else printf "%.4f", k}')
pct=$(awk -v k="$kk" 'BEGIN{printf "%.1f", k*100}')
convert "$f" -resize $pct% -background none -gravity center -extent 256x256 -strip PNG32:"$f"
printf "%-22s ink=%.3f scale=%.2f\n" "$(basename "$f")" "$ink" "$kk"
