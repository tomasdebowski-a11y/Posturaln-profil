#!/bin/bash
# Spustí celou sadu end-to-end testů Posturálního profilu.
# Potřebuje: Node.js s balíčkem playwright (a prohlížeč Chromium), Python 3.
# Použití:  bash tests/run.sh            (z kořene repozitáře)
set -e
T="$(cd "$(dirname "$0")" && pwd)"; R="$(dirname "$T")"; W="$T/.www"; PORT="${PORT:-8780}"
mkdir -p "$W"; cp "$R"/icon-*.png "$R/manifest.json" "$T/back.jpg" "$T/tilted.jpg" "$W/"
# kopie aplikace s testovacím háčkem window.__t (přístup k vnitřnímu stavu pro testy)
python3 - "$R/index.html" "$W/index.html" <<'PY'
import sys
s=open(sys.argv[1],encoding='utf-8').read()
hook="window.__t={aim:()=>({...aim}),pts:()=>JSON.parse(JSON.stringify(pts)),hist:()=>[...hist],src:()=>!!src,type:()=>type,curId:()=>curId,quick:()=>quickMode,ptrs:()=>ptrs.size,view:()=>({...view}),base:()=>({w:base.width,h:base.height}),toScreen:p=>toScreen(p),series:()=>series.length,saved:()=>saved.length,levelReview:()=>levelReview,plumb:()=>plumbMode,rot:()=>rot,calib:()=>calibMode,pid:()=>curPid,mid:()=>curMid,rec:()=>recState,pats:()=>JSON.parse(JSON.stringify(PATS)),meas:()=>JSON.parse(JSON.stringify(MEAS)),bk:()=>({...BK})};\n"
a="loadPrefs();renderProto();"
assert a in s,"háček nenalezen – změnil se inicializační řádek v index.html"
open(sys.argv[2],'w',encoding='utf-8').write(s.replace(a,hook+a,1))
PY
( cd "$W" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
cd "$T" && PORT="$PORT" node e2e.js
