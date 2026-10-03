// s18 C14 (D-790): BVH takes (ACCAD's Female1/Male1/Male2, CC BY 3.0; 100STYLE, CC BY 4.0) read into the CMU path's terms
// (amc.ts): a synthetic Skeleton whose bones carry the ASF names retarget.ts drives the channels from, and per frame the
// posed bones (world rotation relative to the rest, head and tail positions) handed to fk() as they are. A BVH rest pose
// has every joint's world orientation the identity (the ASF convention too); a joint's bone is the segment to its first
// child, so the ASF bone `lfemur` is the BVH joint LeftUpLeg with its direction the LeftLeg offset, and so on.
// Channels are applied in their listed order as intrinsic rotations (Zrotation Xrotation Yrotation: R = Rz Rx Ry).
import { readFileSync } from 'fs';
import { I3, mul, app, norm, type V3, type M3, type Skeleton, type Bone, type Frame, type Posed } from './amc';

interface J { name: string; off: V3; ch: string[]; kids: J[]; end: V3 | null; parent: J | null }
const D = Math.PI / 180;
const R1 = (ax: string, a: number): M3 => { const c = Math.cos(a * D), s = Math.sin(a * D);
  return ax === 'X' ? [1, 0, 0, 0, c, -s, 0, s, c] : ax === 'Y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1]; };

/** the ASF names retarget.ts reads, from the BVH joint names (ACCAD and 100STYLE use the same Mixamo-like set) */
const ASF: Record<string, string[]> = {
  // (first found wins: ACCAD's names first, then 100STYLE's, whose LeftShoulder is the upper arm and LeftCollar the clavicle)
  lowerback: ['ToSpine', 'Chest'], upperback: ['Spine', 'Chest2'], thorax: ['Spine1', 'Spine2', 'Chest4', 'Chest3'], upperneck: ['Neck'], head: ['Head'],
  lclavicle: ['LeftCollar', 'LeftShoulder'], lhumerus: ['LeftArm', 'LeftShoulder'], lradius: ['LeftForeArm', 'LeftElbow'], lwrist: ['LeftForeArm', 'LeftElbow'], lhand: ['LeftHand', 'LeftWrist'],
  rclavicle: ['RightCollar', 'RightShoulder'], rhumerus: ['RightArm', 'RightShoulder'], rradius: ['RightForeArm', 'RightElbow'], rwrist: ['RightForeArm', 'RightElbow'], rhand: ['RightHand', 'RightWrist'],
  lfemur: ['LeftUpLeg', 'LeftHip'], ltibia: ['LeftLeg', 'LeftKnee'], lfoot: ['LeftFoot', 'LeftAnkle'], ltoes: ['LeftToeBase', 'LeftToe'],
  rfemur: ['RightUpLeg', 'RightHip'], rtibia: ['RightLeg', 'RightKnee'], rfoot: ['RightFoot', 'RightAnkle'], rtoes: ['RightToeBase', 'RightToe'],
};

export interface BVHTake { sk: Skeleton; frames: Frame[]; fps: number }
/** `unitM`: metres per BVH unit (ACCAD and 100STYLE: centimetres, measured by the legs' lengths) */
export function readBVH(path: string, unitM = 0.01): BVHTake {
  const tok = readFileSync(path, 'utf8').split(/\s+/).filter(Boolean); let i = 0;
  const joints: J[] = []; const stack: J[] = []; let root: J | null = null;
  while (i < tok.length && tok[i] !== 'MOTION') {
    const t = tok[i++];
    if (t === 'ROOT' || t === 'JOINT') { const j: J = { name: tok[i++], off: [0, 0, 0], ch: [], kids: [], end: null, parent: stack[stack.length - 1] ?? null }; if (j.parent) j.parent.kids.push(j); else root = j; joints.push(j); stack.push(j); }
    else if (t === 'End') { i++; /* Site */ const p = stack[stack.length - 1]; i++; /* { */ i++; /* OFFSET */ p.end = [+tok[i++], +tok[i++], +tok[i++]]; i++; /* } */ }
    else if (t === 'OFFSET') { const j = stack[stack.length - 1]; j.off = [+tok[i++], +tok[i++], +tok[i++]]; }
    else if (t === 'CHANNELS') { const j = stack[stack.length - 1], n = +tok[i++]; for (let k = 0; k < n; k++) j.ch.push(tok[i++]); }
    else if (t === '}') stack.pop();
  }
  i++; // MOTION
  i++; const nF = +tok[i++]; i += 2; const dt = +tok[i++];
  const nCh = joints.reduce((s, j) => s + j.ch.length, 0);
  const byName = new Map(joints.map(j => [j.name, j]));
  const pick = (names: string[]) => names.map(n => byName.get(n)).find(Boolean) ?? null;
  // the bones: ASF name -> its joint, its rest direction (to the first child, else the end site) and length (BVH units)
  const bones = new Map<string, Bone>(), jointOf = new Map<string, J>();
  for (const [an, names] of Object.entries(ASF)) { const j = pick(names); if (!j) continue;
    const seg: V3 = j.kids[0]?.off ?? j.end ?? [0, 1, 0]; const len = Math.hypot(...seg);
    bones.set(an, { name: an, dir: norm(seg), len, C: I3(), Ci: I3(), dof: [], parent: null, children: [] }); jointOf.set(an, j); }
  for (const need of ['upperback', 'thorax', 'upperneck', 'head', 'lhumerus', 'lwrist', 'lhand', 'lfemur', 'ltibia', 'lfoot', 'ltoes', 'rhumerus', 'rwrist', 'rhand', 'rfemur', 'rtibia', 'rfoot', 'rtoes'])
    if (!bones.has(need)) throw new Error(`${path}: no joint for ${need}`);
  const sk: Skeleton = { bones, order: [...bones.keys()], rootOrder: [], unitM };
  const frames: Frame[] = [];
  for (let f = 0; f < nF; f++) {
    const v = tok.slice(i + f * nCh, i + (f + 1) * nCh).map(Number); let c = 0;
    const W = new Map<J, M3>(), P = new Map<J, V3>();
    for (const j of joints) { let L = I3(); let T: V3 = [j.off[0] * unitM, j.off[1] * unitM, j.off[2] * unitM];
      for (const ch of j.ch) { const x = v[c++]; if (ch.endsWith('position')) T['XYZ'.indexOf(ch[0])] = x * unitM; else L = mul(L, R1(ch[0], x)); }
      const pW = j.parent ? W.get(j.parent)! : I3(), pP = j.parent ? P.get(j.parent)! : [0, 0, 0] as V3;
      const o = j.parent ? app(pW, T) : T; P.set(j, [pP[0] + o[0], pP[1] + o[1], pP[2] + o[2]]); W.set(j, mul(pW, L)); }
    const R = new Map<string, M3>(), head = new Map<string, V3>(), tail = new Map<string, V3>();
    for (const [an, j] of jointOf) { R.set(an, W.get(j)!); head.set(an, P.get(j)!);
      const seg: V3 = j.kids[0]?.off ?? j.end ?? [0, 1, 0], d = app(W.get(j)!, [seg[0] * unitM, seg[1] * unitM, seg[2] * unitM]), h = P.get(j)!;
      tail.set(an, [h[0] + d[0], h[1] + d[1], h[2] + d[2]]); }
    // (the ASF wrist is the forearm's end: its tail at the hand joint, as lradius)
    const posed: Posed = { R, head, tail, rootR: W.get(root!)!, rootT: P.get(root!)! };
    frames.push({ root: [], vals: new Map(), P: posed } as Frame & { P: Posed });
  }
  return { sk, frames, fps: Math.round(1 / dt) };
}
