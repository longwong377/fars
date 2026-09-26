// Who a person is, for their voice (D-245; audio/voices.ts): the language label, sex, age and a voice seed of a detailed
// agent (its first language, e.g. 'Elamite'; an age drawn from its seed, as speech_lines.ts voiceFor) or of a person of the
// population (their origin, mapped to a language by audio/voices.ts voiceLang through exchanges.ts HOME_LANG; their age on
// the day; a seed of their own). Shared by the crowd (people/crowd.ts nearPeople) and the offline measurement
// (tools/dev/audio_render.ts), so the two hear the same people.
import { Rng } from '../core/rng';
import { h32, salt } from './hash';
import { ACTIVITIES, type ActivityId } from './activities';
import type { Agent } from './sim';
import type { Population } from './population';
import type { NearPerson } from '../audio/voices';

export interface VoiceIdentity { lang: string; langs?: readonly string[]; sex: 'm' | 'f'; age: number; seed: number }
const SALT_VOICE = salt('crowd-voice');
export function voiceIdentity(a: Agent | null, pid: number, pop: Population | null, day: number, worldSeed: number): VoiceIdentity {
  if (a) { const r = new Rng(a.seed >>> 0, 'voice'); return { lang: a.langs[0] ?? a.origin, langs: a.langs, sex: a.sex, age: a.role === 'child' ? 6 + r.int(0, 5) : 20 + r.int(0, 35), seed: a.seed }; }
  const P = pop!.persons[pid]; return { lang: P.origin, sex: P.sex, age: pop!.ageOn(pid, day), seed: h32(worldSeed, SALT_VOICE, pid) };
}
/** a NearPerson from what the crowd or the view places (feet position in world coordinates) */
export function nearPerson(key: string, id: VoiceIdentity, act: string, moving: boolean, x: number, y: number, z: number, group: string | null): NearPerson {
  return { key, x, y, z, talking: !moving && ACTIVITIES[act as ActivityId]?.sound === 'murmur', eating: act === 'eat', lang: id.lang, langs: id.langs, sex: id.sex, age: id.age, seed: id.seed, group };
}
