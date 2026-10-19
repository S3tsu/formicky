#!/bin/sh
# Zvedne číslo verze na teď (pražský čas, RRRRMMDDhhmm) v sw.js i v index.html najednou.
# Spuštění z kořene repozitáře: sh .github/kontrola/verze.sh
set -e
V=$(TZ=Europe/Prague date +%Y%m%d%H%M)
sed -i.bak "s/^const VER = '[0-9]\{12\}'/const VER = '$V'/" sw.js
sed -i.bak "s/const FH_VER = '[0-9]\{12\}'/const FH_VER = '$V'/" index.html
rm -f sw.js.bak index.html.bak
grep -c "'$V'" sw.js index.html
echo "Verze $V"
