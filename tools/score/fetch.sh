#!/usr/bin/env bash
# The score's instruments and renderer (D-760): clones the sample libraries and builds sfizz into $SCORE_LIB
# (default ~/.cache/parsa-score). Linux (the cloud): apt for fluidsynth and the MuseScore soundfont, cmake for sfizz.
#   Sonatina Symphonic Orchestra  github.com/peastman/sso          CC Sampling Plus 1.0 (non-commercial use is within it)
#   VSCO-2 Community Edition      github.com/sgossner/VSCO-2-CE    CC0
#   sfizz (the SFZ renderer)      github.com/sfztools/sfizz         BSD-2-Clause (a tool, nothing of it ships)
#   MuseScore General soundfont   Ubuntu musescore-general-soundfont MIT
set -euo pipefail
L=${SCORE_LIB:-$HOME/.cache/parsa-score}; mkdir -p "$L"; cd "$L"
[ -d sso ] || git clone --depth 1 https://github.com/peastman/sso sso
[ -d vsco ] || git clone --depth 1 https://github.com/sgossner/VSCO-2-CE vsco
# SSO's SFZ files name some sample folders in lower case (they were made on case-blind file systems): link them
S="sso/Sonatina Symphonic Orchestra/Samples"
for d in "alto flute:Alto Flute" "bass clarinet:Bass Clarinet" "bassoon:Bassoon" "cello:Cello" "clarinet:Clarinet" "contrabassoon:Contrabassoon" \
         "cor anglais:Cor Anglais" "flute:Flute" "horn:Horn" "oboe:Oboe" "piccolo:Piccolo" "tenor trombone:Tenor Trombone" "trumpet:Trumpet" "violin:Violin"; do
  [ -e "$S/${d%%:*}" ] || ln -s "${d#*:}" "$S/${d%%:*}"; done
if [ ! -x sfizz/build/library/bin/sfizz_render ]; then
  [ -d sfizz ] || git clone --depth 1 --recurse-submodules --shallow-submodules https://github.com/sfztools/sfizz sfizz
  mkdir -p sfizz/build && cd sfizz/build
  cmake .. -DCMAKE_BUILD_TYPE=Release -DSFIZZ_JACK=OFF -DSFIZZ_RENDER=ON -DPLUGIN_LV2=OFF -DPLUGIN_VST3=OFF -DPLUGIN_AU=OFF \
    -DPLUGIN_PUREDATA=OFF -DSFIZZ_SHARED=OFF -DSFIZZ_TESTS=OFF -DSFIZZ_BENCHMARKS=OFF -DSFIZZ_DEMOS=OFF >/dev/null
  make -j"$(nproc)" sfizz_render >/dev/null; cd "$L"
fi
command -v fluidsynth >/dev/null && [ -f /usr/share/sounds/sf3/MuseScore_General.sf3 ] || sudo apt-get install -y fluidsynth musescore-general-soundfont
echo "score libraries ready in $L"
