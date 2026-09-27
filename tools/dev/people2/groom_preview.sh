#!/bin/sh
# dev (D-307): regroom the hair cards into public/models/people (the atlas untouched) and render the Blender contact sheet
set -e
W=T:/fars-blender/people2
node -e 'const r=require("./tools/blender/people.json");require("fs").writeFileSync(process.argv[1],JSON.stringify(r.assets.people_hair.source.args))' $W/people_hair/src/args.json
npx tsx tools/blender/sources/people_hair.ts $W/people_hair/src public/models/people $W/people_hair/src/args.json | grep -v "^\[people_hair.*reference"
npx tsx tools/blender/preview_people.ts $W/preview "$@" > /dev/null
"/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b --factory-startup --python tools/blender/preview_people.py -- $W/preview/preview_job.json 2>&1 | grep "preview\]\|Error"
