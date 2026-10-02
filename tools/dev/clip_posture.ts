// s17 V3: each capture clip's mean trunk pitch (hips, spine, chest, neck, head X; +X bows forward) and the arms' mean abduction
import { CLIPS, clipMean } from '../../src/people/mocap';
const B = ['hips', 'spine', 'chest', 'neck', 'head', 'l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand', 'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot'];
const d = (x: number) => (x * 180 / Math.PI).toFixed(1).padStart(6);
for (const id of Object.keys(CLIPS)) { const M = clipMean(id); const x = (n: string, c = 0) => M[B.indexOf(n) * 3 + c];
  console.log(id.padEnd(16), CLIPS[id].kind, 'hips', d(x('hips')), 'spine', d(x('spine')), 'chest', d(x('chest')), 'neck', d(x('neck')), 'head', d(x('head')), '| trunk', d(x('hips') + x('spine') + x('chest')),
    '| l_up', d(x('l_upper')), d(x('l_upper', 1)), d(x('l_upper', 2)), 'r_up', d(x('r_upper')), d(x('r_upper', 1)), d(x('r_upper', 2)), 'l_fore', d(x('l_fore')), d(x('l_fore', 2)), 'hipZ', (M[53] * 100).toFixed(1)); }
