# s17 ownership audit (the cloud lead): every src/**/*.ts mapped to its owner from sessions/s17-vagon-v2.md; prints the unowned and the doubly owned. Re-run after any new file or ownership change.
import re,subprocess,collections
O={
'V1 light':[r'src/render/(pipeline|toneLook|ssgi|sunShadows|airlight|envmap)\.ts',r'src/sky/',r'src/render/probes/'],
'V2 materials':[r'src/render/(materials|scans|grime|masonry|blockface)\.ts',r'src/world/settlement/surfaces\.ts',r'src/terrain/(terrainDetail|detail_worker)\.ts',r'src/world/plain/waterShade\.ts'],
'V3 people':[r'src/people/(?!animal|converse/|living/|(population|popgeo|sim|aims|calendar|camps|construction|court|courtYear|roofs|history)\.ts)'],
'V4 terrace':[r'src/arch/(?!rooms\.ts|terrace_rooms\.ts)',r'src/render/(monuments|reliefAtlas)\.ts'],
'V5 animals+weather':[r'src/people/animal',r'src/world/(beasts|lifeModels|weatherVfx|rainShafts|dust\w*|\w*Smoke|breath|season)\.ts',r'src/world/plain/seasonal\.ts',r'src/weather/'],
'V6 int light':[r'src/arch/(rooms|terrace_rooms)\.ts',r'src/world/(fire|fireOcc|firePlaces)\.ts'],
'C1 town':[r'src/world/settlement/(?!surfaces)',r'src/world/(fill|fillPlan|roadLitter)\.ts'],
'C2 plain':[r'src/world/plain/(?!seasonal|waterShade)',r'src/world/(groundRocks|groundFlora)\.ts',r'src/world/trees/'],
'C3 roads':[r'src/world/(traffic|construction|courtCamps|tentForms|terraceFoot|fauna|wildlife|smallLife|roadFolk)\.ts',r'src/world/visitor/'],
'C4 load':[r'src/render/(models|loaders)\.ts',r'src/main\.ts',r'src/world/cache/'],
'C5 screens':[r'src/shell/',r'src/ui/'],
'C6 far':[r'src/world/hills/',r'src/terrain/(terrainMesh|horizonMap|horizonShadow|heightfield)\.ts'],
'C7 interiors':[r'src/world/interiors/',r'src/world/(furnish|furnish_palaces|writing)\.ts'],
'C8 sound':[r'src/audio/(?!speech|voices|phonemes|neural/)'],
'C9 walk':[r'src/player/',r'src/core/input\.ts',r'src/world/solids\.ts'],
'C10 life':[r'src/people/(population|popgeo|sim|aims|calendar|camps|construction|court|courtYear|roofs|history)\.ts',r'src/people/living/'],
'orphans':[r'src/render/(skyVis|eyeRays|scanProps|sss|reliefShadow|incision|decorAssets|fireGlow|progressive|lowfirst|shareInstancing|compat|far_terrace\w*)\.ts'],
'unchanged today (talk, core, lang, leads)':[r'src/people/converse/',r'src/audio/(speech|voices|phonemes)\.ts',r'src/audio/neural/',r'src/core/(?!input)',r'src/lang/',r'src/world/(world|nowview|bench)\.ts',r'src/dev/',r'src/render/(fx|mx_noise_cpu|meter)\.ts'],
}
files=subprocess.run(['git','ls-files','src'],capture_output=True,text=True).stdout.split()
un=collections.defaultdict(list); multi=[]
for f in files:
    if not f.endswith('.ts'): continue
    hits=[k for k,ps in O.items() if any(re.match(p,f) for p in ps)]
    if not hits: un[f.rsplit('/',1)[0]].append(f.rsplit('/',1)[1])
    elif len(hits)>1: multi.append((f,hits))
for d,fs in sorted(un.items()): print(f'{d}/ ({len(fs)}): '+' '.join(fs))
print('MULTI:',multi)
