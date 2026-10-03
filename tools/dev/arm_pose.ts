// s17 V3: the bind pose's arm (joint positions of a variant)
import { readFileSync } from 'node:fs'; import { decodeHumanAssets } from '../../src/people/humanAssets'; import { HB } from '../../src/people/humanFormat';
const b = readFileSync('public/generated/humans/humans.bin'); const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const v = A.byId[process.argv[2] ?? 'm03']; const j = (n: string) => [...v.joints.slice((HB as any)[n] * 3, (HB as any)[n] * 3 + 3)].map(x => +x.toFixed(3));
const u = j('upperarm_l'), l = j('lowerarm_l'); console.log('upperarm', u, 'lowerarm', l, 'hand', j('hand_l'), 'angle from vertical (deg)', (Math.atan2(l[0] - u[0], u[1] - l[1]) * 180 / Math.PI).toFixed(1));
