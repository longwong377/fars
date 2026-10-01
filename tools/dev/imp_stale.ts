// D-363: is the Cycles impostor atlas laid out for this build's frames and dresses? (impostors.loadImpostorAtlas's check)
import { readFileSync } from 'node:fs';
import { FRAMES, IMP_DRESSES, IMP } from '../../src/people/impostors';
const J = JSON.parse(readFileSync('public/models/impostors/people_impostors.json', 'utf8')), ids = FRAMES.map(f => f.id);
console.log('frames match', JSON.stringify(J.frames) === JSON.stringify(ids), 'dresses', JSON.stringify(J.dresses) === JSON.stringify(IMP_DRESSES), 'views', J.views === IMP.views, 'w/h/y0', J.width === IMP.width, J.height === IMP.height, J.y0 === IMP.y0);
console.log('in atlas, not in build:', J.frames.filter((f: string) => !ids.includes(f)).join(' '), '| in build, not in atlas:', ids.filter(f => !J.frames.includes(f)).join(' '));
