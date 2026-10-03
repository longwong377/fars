// Visitor mode (brief §1: "the player is a traveller carrying a sealed travel authorisation. Access follows
// period-plausible rules, and guards stop you where they would have"; §9.5 "period-plausible errands"): the visitor's
// state, the stop at a post, showing the halmi, the escort, and the errand "a sealed letter for the treasurer"
// (src/data/access.json, research/ACCESS.md, D-100 … D-104; everything at Persepolis itself is C). No HUD: the world
// answers through the guards (a turn, a line in their language, a gesture) and the errand's state is readable only in the
// translation layer's chronicle. The controller is pure logic over small interfaces (node-testable); world.ts wires it
// to the simulation, the crowd and the speech system, and main.ts keeps the player out of zones it may not enter.
import { accessZoneAt, decide, businessZones, ZONES, ERRAND, TownIndex, Decision } from './access';
import placesJson from '../../data/people_places.json';

type P2 = [number, number];
/** a guard as the controller sees it (a simulated agent standing at a post) */
export interface GuardLike { id: number; pos: P2; post: string | null; onDuty: boolean }
export interface VisitorWorld {
  guards(): GuardLike[];
  /** 0..1 familiarity of this person with the visitor (lives.json thresholds); `recognise` is the level at which they know him */
  familiarity(id: number): number; recognise: number;
  /** a guard reacts: turns to the visitor, speaks a line of this intent in his language (returns false if he has none) */
  react(guardId: number, intent: 'ask_document' | 'refuse' | 'affirm' | 'greet', now: number): boolean;
  /** the escort figure: shown beside the visitor (x, z world, facing yaw), or removed (null) */
  escort(at: { x: number; z: number; yaw: number } | null): void;
}
const place = (id: string): P2 => ((placesJson as any).places.find((p: any) => p.id === id)?.at ?? [NaN, NaN]) as P2;
/** minutes until an escort comes (C: "a guard goes for an escort; the visitor waits on the bench", access.json stop_procedure) */
export const ESCORT_WAIT_H = 4 / 60;
/** D-696: how far the stranger is walked back from a post's line (m) and how far each frame (m: ~1.2 m/s at 30 frames a second) */
export const PUSH_M = 0.8, PUSH_STEP = 0.04;
/** within this distance of a step's place, the interact key does that step's business (m) */
const AT_PLACE = 6;

export interface VisitorState {
  step: number; halmi: boolean; letter: 'carried' | 'handed' | 'answer' | 'delivered';
  /** zones admitted on the current step (halmi shown at their post) */ admitted: string[];
  escortFrom: number | null; escorted: boolean;
  /** world hours: when the Treasury's answer is ready */ answerAt: number | null;
  /** the last stop: zone, guard and world hours */ stop: { zone: string; guard: number | null; t: number; needs: Decision['needs'] } | null;
  log: { t: number; text: string }[];
}
export class Visitor {
  s: VisitorState = { step: 1, halmi: true, letter: 'carried', admitted: [], escortFrom: null, escorted: false, answerAt: null, stop: null, log: [] };
  private lastOk: { x: number; z: number } | null = null;
  private push: { x: number; z: number } | null = null; private pushAt: { x: number; z: number } | null = null;
  constructor(private W: VisitorWorld, private town: TownIndex | null) {}
  /** the zone and the decision for a world position (x, z) now */
  check(x: number, z: number, t: number, night: boolean, court: boolean) {
    const zone = accessZoneAt(x, -z, this.town);
    const guardsHere = this.W.guards().filter(g => g.post && ZONES.get(zone)?.checked_at.includes(g.post));
    const recognised = guardsHere.some(g => this.W.familiarity(g.id) >= this.W.recognise) && this.s.admitted.length > 0;
    const d = decide(zone, { night, court, admitted: new Set(this.s.admitted), business: this.business(t), escorted: this.s.escorted, recognised });
    return { zone, d, guardsHere };
  }
  /** zones the current step makes the visitor's business (the step's own zone, its inside and route zones, and the
   *  zones on the way to it that are open anyway) */
  business(t: number): Set<string> {
    const b = businessZones(this.s.step);
    // carrying the letter (or going back for the answer), his business is the way to the Treasury door
    if (this.s.letter === 'carried' || (this.s.letter === 'handed' && this.s.step >= 7)) { b.add('gate_nations'); b.add('terrace_courts'); b.add('treasury_street'); }
    void t; return b;
  }
  /** per frame: the player's proposed position; returns where the player may stand (the last allowed point if the move
   *  enters a zone he may not), and lets the post's guard react once per stop */
  update(p: { x: number; z: number; yaw: number }, t: number, night: boolean, court: boolean): { x: number; z: number; blocked: boolean } {
    if (this.s.escortFrom != null && !this.s.escorted && t - this.s.escortFrom >= ESCORT_WAIT_H) { this.s.escorted = true; this.note(t, 'an escort from the Gate guard walks with you'); }
    const { zone, d, guardsHere } = this.check(p.x, p.z, t, night, court);
    // (D-696: the escort walks at your right shoulder, a little ahead, not 1.4 m before your eyes)
    if (this.s.escorted) this.W.escort({ x: p.x + Math.cos(p.yaw) * 0.45 + Math.sin(p.yaw) * 0.9, z: p.z - Math.sin(p.yaw) * 0.45 + Math.cos(p.yaw) * 0.9, yaw: p.yaw });
    if (d.allowed) {
      this.lastOk = { x: p.x, z: p.z }; this.push = null; this.pushAt = null;
      if (this.s.escorted && !['gate_nations', 'terrace_courts', 'treasury_street', 'treasury_desk'].includes(zone)) { this.s.escorted = false; this.s.escortFrom = null; this.W.escort(null); }
      this.progress(zone, p, t);
      return { x: p.x, z: p.z, blocked: false };
    }
    // stopped: the nearest guard of this zone's posts (else anyone on duty nearby) reacts, once per stop
    const near = (guardsHere.length ? guardsHere : this.W.guards().filter(g => g.onDuty))
      .map(g => ({ g, d: Math.hypot(g.pos[0] - p.x, g.pos[1] + p.z) })).filter(q => q.d < 40).sort((a, b) => a.d - b.d)[0]?.g ?? null;
    if (!this.s.stop || this.s.stop.zone !== zone || t - this.s.stop.t > 0.05) {
      this.s.stop = { zone, guard: near?.id ?? null, t, needs: d.needs };
      if (near) this.W.react(near.id, d.needs === 'halmi' || d.needs === 'letter' ? 'ask_document' : 'refuse', t);
      this.note(t, d.needs === 'halmi' ? `stopped at ${zone.replace(/_/g, ' ')}: the guard asks for your sealed travel document`
        : d.needs === 'letter' ? `stopped at ${zone.replace(/_/g, ' ')}: the guard asks your business here`
        : d.needs === 'escort' ? `stopped at ${zone.replace(/_/g, ' ')}: you may not walk here alone`
        : `turned back at ${zone.replace(/_/g, ' ')}: closed to you`);
    }
    // (s18 C5, D-696; C12 4-3: not an invisible wall) turned back bodily: the stranger is walked back from the post's line
    // PUSH_M m the way they came, at a walking pace over the next frames, the guard's arm out (W.react above), rather
    // than held dead at the line
    const back = this.lastOk ?? { x: p.x, z: p.z };
    if (!this.push || Math.hypot(this.push.x - back.x, this.push.z - back.z) > PUSH_M + 0.5) { const ax = back.x - p.x, az = back.z - p.z, L = Math.hypot(ax, az);
      const ux = L > 1e-4 ? ax / L : -Math.cos(p.yaw), uz = L > 1e-4 ? az / L : Math.sin(p.yaw); this.push = { x: back.x + ux * PUSH_M, z: back.z + uz * PUSH_M }; }
    const q = this.pushAt ?? back, dx = this.push.x - q.x, dz = this.push.z - q.z, dd = Math.hypot(dx, dz), k = dd > PUSH_STEP ? PUSH_STEP / dd : 1;
    this.pushAt = { x: q.x + dx * k, z: q.z + dz * k }; if (k === 1) { this.lastOk = { ...this.push }; this.push = null; this.pushAt = null; return { x: this.lastOk.x, z: this.lastOk.z, blocked: true }; }
    return { x: this.pushAt.x, z: this.pushAt.z, blocked: true };
  }
  /** the interact key: show the halmi to the guard who stopped you; or do the current step's business where you stand */
  interact(p: { x: number; z: number }, t: number, night: boolean, court: boolean): string | null {
    const st = this.s.stop;
    // (W18, D-696: the halmi at the road's and the town's posts; on the Terrace the sealed letter for the treasurer, its seal
    // and its address shown, is the business; after it is handed over, the answer awaited is)
    const shows = st && (st.needs === 'halmi' ? this.s.halmi : st.needs === 'letter' ? this.s.letter !== 'delivered' : false);
    if (st && t - st.t < 0.1 && shows && this.business(t).has(st.zone)) {
      if (!this.s.admitted.includes(st.zone)) this.s.admitted.push(st.zone);
      if (st.guard != null) this.W.react(st.guard, 'affirm', t);
      if (st.zone === 'gate_nations') { this.s.escortFrom = t; this.s.step = Math.max(this.s.step, 4); }
      this.s.stop = null; return this.note(t, st.needs === 'halmi' ? `you show your sealed travel document at ${st.zone.replace(/_/g, ' ')}: let through`
        : `you show the sealed letter for the treasurer at ${st.zone.replace(/_/g, ' ')}: admitted on its business`);
    }
    // while the letter is at the Treasury, the door is where to ask for word (steps 6 and 7)
    const step = ERRAND.steps.find(q => q.n === (this.s.letter === 'handed' ? 7 : this.s.step));
    if (!step) return null;
    const at = step.at as P2, dist = Math.hypot(at[0] - p.x, at[1] + p.z);
    const { zone } = this.check(p.x, p.z, t, night, court);
    if (dist > AT_PLACE && zone !== step.zone) return null;
    return this.doStep(step.n, t);
  }
  private doStep(n: number, t: number): string | null {
    const day = Math.floor(t / 24), hour = t - day * 24;
    switch (n) {
      case 1: this.s.step = 2; return this.note(t, 'the storekeeper reads your halmi and gives the day\'s ration; a receipt is sealed');
      case 5: // hand over the letter; the answer next morning if before midday, else the morning after next (access.json timing, C)
        if (this.s.letter !== 'carried') return null;
        this.s.letter = 'handed'; this.s.answerAt = (day + (hour < 12 ? 1 : 2)) * 24 + 7; this.s.step = 6; this.s.admitted = [];
        return this.note(t, 'you hand the sealed letter to the Treasury door; word will come in the morning');
      case 6: case 7:
        if (this.s.letter !== 'handed' || this.s.answerAt == null || t < this.s.answerAt) return this.note(t, 'not yet: the answer is not ready');
        this.s.letter = 'answer'; this.s.step = 8; return this.note(t, 'at the Treasury door you receive the sealed answer for your master');
      case 8: this.s.step = 9; return this.note(t, 'at the official building you ask for a halmi for the road home; it is sealed for you');
      case 9: this.s.step = 10; return this.note(t, 'the storekeeper gives the first day\'s ration for the road');
      default: return null;
    }
  }
  /** steps that complete by going somewhere: the climb, the escorted walk, the night, leaving by the royal road */
  private progress(zone: string, p: { x: number; z: number }, t: number) {
    if (this.s.step === 2 && (zone === 'gate_nations' || Math.hypot(p.x - place('gate_hall')[0], -p.z - place('gate_hall')[1]) < 12)) this.s.step = 3;
    if (this.s.step === 4 && zone === 'treasury_street') this.s.step = 5;
    if (this.s.step === 6 && this.s.answerAt != null && t >= this.s.answerAt) { this.s.step = 7; this.s.admitted = []; }
    if (this.s.step === 10 && (zone === 'roads' || zone === 'plain_open')) { this.s.step = 11; this.s.letter = 'delivered'; this.note(t, 'you leave by the royal road; the errand is done'); }
  }
  private note(t: number, text: string) { this.s.log.push({ t, text }); if (this.s.log.length > 60) this.s.log.shift(); return text; }
  save() { return JSON.parse(JSON.stringify(this.s)); }
  load(s: VisitorState | null | undefined) { if (s && typeof s.step === 'number') this.s = { ...this.s, ...s }; }
}
