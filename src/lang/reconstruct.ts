// D-387 (UD-24, tier C): RECONSTRUCTED PERIOD SPEECH. The attested vocabularies are tiny (Old Persian has no attested word for
// grain, bread or debt), so two people talking of dear barley could not say so in words. UD-24 loosens §10 for this: people
// talk of whatever their lives need, "voiced as reconstructed period speech, flagged tier C". `reconstruct(english, lang)`
// renders a short English sentence in a language, word by word, from three source classes, in this order:
//   'attested'  the lexicon's own word (research/LEXICON; the concept table names it, or its gloss is the English word);
//   'cognate'   a form known from the language's own wider corpus or its nearest kin, written here with its source:
//               Old Persian from the royal inscriptions outside the lexicon, Avestan and Middle Persian cognates (yava- for
//               barley, Av. yauua-); Elamite from the Persepolis Fortification tablets (Hallock); Aramaic from Elephantine
//               and Biblical Aramaic; Akkadian (Late Babylonian) dictionary words; Greek from Herodotus' Ionic;
//   'rule'      none of those: a pseudo-word built from that language's own sounds and syllable shapes, counted from the
//               lexicon's IPA (audio/murmur.ts buildProfile), keyed by the English word so the same word is always the same
//               form in that language (a player who learns it can hear it again).
// Word order by the language (C): verb last for Old Persian, Elamite and Babylonian (SOV); Aramaic verb-first or after the
// subject (VSO/SVO, chosen per sentence), demonstratives after the noun (as in Babylonian); Greek keeps the English order.
// Function words are dropped or given an attested particle (not, and, this, I, you). Every form is checked: the synthesiser's
// tokenizer accepts it, the voice model keeps it (toKokoro), and no form spells a common modern word (lang/modern.ts).
// Pure and deterministic. Out of world: `gloss` (English) and the per-word source classes (the translation layer, F3).
import { LEXICON, LANG_IDS, type LangId } from './lexicon';
import { findModernWords } from './modern';
import { unitsFor, type Unit } from '../audio/voices';
import { buildProfile, pseudoWord, type LangProfile } from '../audio/murmur';
import { tokenizeIpa } from '../audio/phonemes';
import { toKokoro } from '../audio/neural/kokoro';
import { Rng, hashString } from '../core/rng';

export type WordSrc = 'attested' | 'cognate' | 'rule';
export interface RcWord { en: string; form: string; ipa: string; attested: boolean; src: WordSrc; pos: Pos; note?: string }
export interface Reconstructed { english: string; lang: LangId; ipa: string; translit: string; gloss: string; tier: 'C'; words: RcWord[]; intonation: 'fall' | 'rise' | 'level' }
type Pos = 'n' | 'v' | 'a' | 'd' | 'neg' | 'conj' | 'pro' | 'adv';
/** a cognate form: [ipa, translit, source note] */
type Cog = readonly [string, string, string];
/** per language: an attested lexicon form (its id's form or its spoken transliteration), or a cognate form */
type Slot = string | Cog;
interface Concept { en: readonly string[]; pos: Pos; f: Partial<Record<LangId, Slot>> }

// The concept table. Strings name an attested lexicon entry; triples are cognate forms with their source (C).
const CONCEPTS: readonly Concept[] = [
  { en: ['barley'], pos: 'n', f: { op: ['jawa', 'yava', 'Av. yauua- grain, barley'], el: 'kurrušam', arc: ['ʃəʕaːriːn', 'šəʿārīn', 'Elephantine šʿrn barley'], bab: 'uṭṭatu', grc: ['ˈkritʰai', 'krithai', 'Ionic κριθαί barley (Hdt.)'] } },
  { en: ['grain', 'corn'], pos: 'n', f: { op: ['jawa', 'yava', 'Av. yauua- grain'], el: 'kurrušam', arc: ['ʕabuːr', 'ʿabūr', 'Elephantine ʿbwr grain'], bab: 'uṭṭatu', grc: 'sitos' } },
  { en: ['bread', 'food', 'loaf'], pos: 'n', f: { op: ['pitu', 'pitu', 'Av. pitu- food'], el: 'gal', arc: 'laḥm', bab: 'akalu', grc: 'artos' } },
  { en: ['ration', 'rations'], pos: 'n', f: { op: ['piθfa', 'piθfa', 'OP *piθfa- ration, from its Elamite loan (Tavernier)'], el: 'gal', arc: ['pəraːs', 'pərās', 'Elephantine prs ration'], bab: 'kurummatu', grc: 'sitia' } },
  { en: ['dear', 'costly', 'heavy', 'hard'], pos: 'a', f: { op: ['ɡaru', 'garu', 'Av. gouru-, Skt. guru- heavy; MP grān dear'], arc: ['jaqqiːr', 'yaqqīr', 'Bibl. Aram. yaqqîr heavy, precious'], bab: ['kabtu', 'kabtu', 'Akk. kabtu heavy, dear'], grc: ['ˈtiːmios', 'tīmios', 'Ionic τίμιος dear, costly'] } },
  { en: ['this', 'these'], pos: 'd', f: { op: 'ima', el: 'hi', arc: ['dənaː', 'dənā', 'Imperial Aram. dnh this'], bab: 'agâ' } },
  { en: ['give', 'gives', 'gave', 'given'], pos: 'v', f: { op: ['dadaːti', 'dadāti', 'OP dā- give (Av. dadāiti)'], el: ['dunuʃ', 'dunuš', 'PF dunuš (he) gave'], arc: 'yəhab', bab: ['iddin', 'iddin', 'Akk. nadānu, iddin he gave'], grc: ['diˈdɔːsi', 'didōsi', 'δίδωσι gives'] } },
  { en: ['silver'], pos: 'n', f: { op: 'ṛdata', arc: 'kəsap', bab: 'kaspu', grc: ['ˈarɡyros', 'arguros', 'ἄργυρος silver'] } },
  { en: ['harvest'], pos: 'n', f: { arc: ['ħəsˤaːd', 'ḥəṣād', 'Aram. ḥṣd reap'], bab: ['esˤeːdu', 'eṣēdu', 'Akk. eṣēdu harvest'], grc: ['ˈamɛːtos', 'amētos', 'ἄμητος harvest'] } },
  { en: ['owe', 'owes', 'debt'], pos: 'v', f: { arc: ['ħoːb', 'ḥōb', 'Elephantine ḥwb debt'], bab: ['xubullu', 'ḫubullu', 'Akk. ḫubullu debt'], grc: ['ˈkʰreos', 'khreos', 'χρέος debt'] } },
  { en: ['house', 'household', 'home'], pos: 'n', f: { op: ['maːnija', 'māniya', 'DB 1.65 māniya- household'], el: 'ulhi', arc: 'bayt', bab: 'bīt', grc: ['ˈoikos', 'oikos', 'οἶκος house'] } },
  { en: ['die', 'died', 'dies', 'dead'], pos: 'v', f: { op: ['amarijataː', 'amariyatā', 'DB 1.43 amariyatā (he) died'], el: ['halpika', 'halpika', 'DB Elam. halpi- die, be killed'], arc: ['miːt', 'mīt', 'Aram. mwt die'], bab: ['imuːt', 'imūt', 'Akk. mâtu, imūt he died'], grc: ['ˈetʰane', 'ethane', 'ἔθανε (he) died'] } },
  { en: ['god'], pos: 'n', f: { op: 'baga', el: 'nap', arc: 'ʾɛlāh', bab: 'ilu', grc: ['tʰeˈos', 'theos', 'θεός god'] } },
  { en: ['keep', 'keeps', 'protect', 'guard'], pos: 'v', f: { op: 'pātu', el: 'nuškišni', arc: ['nətˤar', 'nəṭar', 'Aram. nṭr keep'], bab: 'liṣṣur', grc: ['ˈsɔːizoi', 'sōizoi', 'σῴζοι may (he) keep safe'] } },
  { en: ['son', 'sons'], pos: 'n', f: { op: 'puça', el: 'šak', arc: 'bar', bab: 'māru', grc: 'pais' } },
  { en: ['born'], pos: 'v', f: { op: ['zaːta', 'zāta', 'Av. zāta- born'], arc: ['jəliːd', 'yəlīd', 'Aram. yld bear'], bab: ['iwwalid', 'iwwalid', 'Akk. walādu, iwwalid was born'], grc: ['eˈɡeneto', 'egeneto', 'ἐγένετο was born'] } },
  { en: ['child', 'children', 'baby'], pos: 'n', f: { op: 'puça', el: ['puhu', 'puhu', 'PF puhu boys, children (Hallock)'], arc: ['ʕəleːm', 'ʿəlēm', 'Aram. ʿlym lad (C)'], bab: ['sˤexru', 'ṣeḫru', 'Akk. ṣeḫru small, child'], grc: 'pais' } },
  { en: ['take', 'took', 'takes', 'wed', 'married'], pos: 'v', f: { op: ['aɡarbaːja', 'agarbāya', 'DB agarbāya (he) seized, took'], el: 'kuzza', arc: ['nəsab', 'nəsab', 'Elephantine nsb take (a wife)'], bab: ['iːxuz', 'īḫuz', 'Akk. aḫāzu take in marriage'], grc: ['ˈeɡɛːme', 'egēme', 'ἔγημε (he) married'] } },
  { en: ['wife', 'woman', 'women'], pos: 'n', f: { op: ['ɡənaː', 'gənā', 'Av. gənā- woman, wife'], el: ['paʃap', 'pašap', 'PF pašap women (Hallock)'], arc: ['ʔintaː', 'ʾintā', 'Elephantine ʾnth wife'], bab: ['aʃʃatu', 'aššatu', 'Akk. aššatu wife'], grc: 'gunē' } },
  { en: ['many', 'much'], pos: 'a', f: { op: 'paru', arc: ['ʃaɡɡiːʔ', 'śaggīʾ', 'Bibl. Aram. śaggîʾ many'], bab: 'mādūtu', grc: ['ˈpolloi', 'polloi', 'πολλοί many'] } },
  { en: ['sick', 'ill', 'sickness'], pos: 'a', f: { op: ['axti', 'axti', 'Av. axti- sickness, pain'], arc: ['mariːʕ', 'marīʿ', 'Aram. mrʿ be sick'], bab: ['marsˤu', 'marṣu', 'Akk. marṣu sick'], grc: ['ˈkamneː', 'kamnei', 'κάμνει (he) is ill, weary'] } },
  { en: ['work', 'labour', 'works'], pos: 'n', f: { op: ['warza', 'varza', 'Av. varəz- work'], arc: 'ʿabīdā', bab: ['dullu', 'dullu', 'LB dullu work, service'], grc: 'ergon' } },
  { en: ['worker', 'workers', 'labourers'], pos: 'n', f: { op: 'kṛnuvaka', el: 'kurtaš', arc: ['ʕaːbdiːn', 'ʿābdīn', 'Aram. ʿbd (they who) work'], bab: ['sˤaːbuː', 'ṣābū', 'LB ṣābū workmen'], grc: ['erˈɡaːtai', 'ergātai', 'ἐργάται workers'] } },
  { en: ['king'], pos: 'n', f: { op: 'xšāyaθiya', el: 'sunki / EŠŠANA', arc: 'malk', bab: 'šarri', grc: 'basileus' } },
  { en: ['build', 'builds', 'built'], pos: 'v', f: { op: 'akunavam', el: 'hutta / huttašta', arc: 'bənā', bab: 'ēteppuš', grc: ['oikoˈdomei', 'oikodomei', 'οἰκοδομεῖ builds'] } },
  { en: ['great', 'big'], pos: 'a', f: { op: 'vazṛka', el: 'iršarra', arc: 'rab', bab: 'rabû', grc: ['ˈmeɡas', 'megas', 'μέγας great'] } },
  { en: ['feast', 'festival'], pos: 'n', f: { op: ['jadana', 'yadana', 'OP yad- worship (XPh ayadaiy)'], arc: ['ħaɡ', 'ḥag', 'Elephantine ḥg festival'], bab: ['isinnu', 'isinnu', 'Akk. isinnu festival'], grc: ['heorˈtɛː', 'heortē', 'ἑορτή festival'] } },
  { en: ['meat'], pos: 'n', f: { arc: ['bəsar', 'bəśar', 'Aram. bśr flesh'], bab: ['ʃiːru', 'šīru', 'Akk. šīru flesh, meat'], grc: 'krea' } },
  { en: ['wine'], pos: 'n', f: { op: ['madu', 'madu', 'Av. maδu- mead, wine'], arc: 'ḥamar', bab: 'karānu', grc: 'oinos' } },
  { en: ['good'], pos: 'a', f: { op: 'nai̯bam', arc: 'ṭāb', bab: 'babbanû', grc: 'agathos' } },
  { en: ['field', 'fields'], pos: 'n', f: { arc: ['ħaqal', 'ḥaqal', 'Aram. ḥql field'], bab: ['eqlu', 'eqlu', 'Akk. eqlu field'], grc: ['aˈɡros', 'agros', 'ἀγρός field'] } },
  { en: ['stranger', 'foreigner'], pos: 'n', f: { arc: ['nukraːj', 'nukrāy', 'Aram. nkry foreign'], bab: ['axuː', 'aḫû', 'Akk. aḫû stranger'], grc: 'xeine' } },
  { en: ['come', 'came', 'comes'], pos: 'v', f: { op: ['aːiʃa', 'āiša', 'DB āiša (he) went, came'], arc: ['ʔətaː', 'ʾətā', 'Aram. ʾty come'], bab: ['illik', 'illik', 'Akk. alāku, illik he went'], grc: ['ˈɛːltʰe', 'ēlthe', 'ἦλθε (he) came'] } },
  { en: ['town', 'city', 'quarter'], pos: 'n', f: { op: 'vṛdana', arc: 'qiryā', bab: ['aːlu', 'ālu', 'Akk. ālu town'], grc: ['ˈpolis', 'polis', 'πόλις town'] } },
  { en: ['water'], pos: 'n', f: { op: 'api', arc: ['majin', 'mayin', 'Aram. myn water'], bab: 'mû', grc: 'udōr' } },
  { en: ['rain'], pos: 'n', f: { op: ['waːra', 'vāra', 'Av. vār- rain'], arc: ['mitˤraː', 'miṭrā', 'Aram. mṭr rain'], bab: ['zunnu', 'zunnu', 'Akk. zunnu rain'], grc: ['hyeˈtos', 'huetos', 'ὑετός rain'] } },
  { en: ['mother'], pos: 'n', f: { op: ['maːtaː', 'mātā', 'Av. mātar-, OP nom. *mātā'], arc: ['ʔimmaː', 'ʾimmā', 'Aram. ʾm mother'], bab: ['ummu', 'ummu', 'Akk. ummu mother'], grc: 'mētēr' } },
  { en: ['daughter'], pos: 'n', f: { arc: ['bərat', 'bərat', 'Aram. brt daughter'], bab: ['maːrtu', 'mārtu', 'Akk. mārtu daughter'], grc: 'thugatēr' } },
  { en: ['there'], pos: 'adv', f: { arc: 'ʾītay' } },
  { en: ['not', 'no', 'never'], pos: 'neg', f: { op: 'nai̯', el: 'inni', arc: 'lā', bab: 'lā', grc: 'ou' } },
  { en: ['and'], pos: 'conj', f: { op: 'utā', el: 'ak', bab: 'u' } },
  { en: ['i'], pos: 'pro', f: { op: 'adam', el: 'u', arc: ['ʔanaː', 'ʾanā', 'Imperial Aram. ʾnh I'], bab: 'anāku', grc: 'egō' } },
  { en: ['you'], pos: 'pro', f: { op: 'tuvam', el: 'nu', arc: ['ʔanta', 'ʾanta', 'Imperial Aram. ʾnt(h) you'], bab: ['atta', 'atta', 'Akk. atta you'], grc: 'su' } },
  { en: ['father'], pos: 'n', f: { op: 'pitā', el: 'attata', arc: 'ʾab', bab: 'abūa', grc: 'patēr' } },
  { en: ['me'], pos: 'pro', f: { grc: 'moi' } },
];
/** English words carried by grammar, not by a word of their own (dropped; C) */
const FUNCTION = new Set(('a an the is are was were be been being of in on at to for from by with into it its his her their our them they he she him ' +
  'has have had will shall would may might must do does did that which who whom whose as so than then very also back until there').split(' '));
/** English compounds spoken as two concepts */
const EXPAND: Readonly<Record<string, string[]>> = { today: ['this', 'day'], tonight: ['this', 'night'], tomorrow: ['the', 'day'] };
const BY_EN = new Map<string, Concept>(); for (const c of CONCEPTS) for (const w of c.en) if (!BY_EN.has(w)) BY_EN.set(w, c);

// ---- attested words: by the concept table's name, else by gloss (the gloss's first senses, as single words)
const senseIndex = new Map<LangId, Map<string, Unit>>();
function senses(lang: LangId): Map<string, Unit> {
  let m = senseIndex.get(lang); if (m) return m; m = new Map();
  for (const u of unitsFor(lang).words) {
    const g = u.gloss.replace(/\([^)]*\)?/g, ' ').replace(/'[^']*'?/g, ' ').toLowerCase();
    for (let s of g.split(/[,;/]/)) { s = s.replace(/[!?.]/g, '').replace(/^\s*(the|to|a|an)\s+/, '').trim(); if (s && !/\s/.test(s) && !m.has(s)) m.set(s, u); }
  }
  senseIndex.set(lang, m); return m;
}
function attestedUnit(lang: LangId, form: string): Unit | undefined { return unitsFor(lang).words.find(u => u.id === `${lang}:${form}` || u.translit === form); }

// ---- the rule: pseudo-words from the language's own sounds
const profiles = new Map<LangId, LangProfile>();
let reserved: Map<LangId, Set<string>> | null = null;
/** every IPA form that already means something in a language (its lexicon and the table's cognates): a pseudo-word never repeats one */
function reservedOf(lang: LangId): Set<string> {
  if (!reserved) { reserved = new Map(); for (const l of LANG_IDS) { const s = new Set<string>(); for (const e of LEXICON[l]) if (e.ipa) for (const w of e.ipa.split(' ')) s.add(w.replace(/[ˈˌ]/g, '')); for (const c of CONCEPTS) { const f = c.f[l]; if (f && typeof f !== 'string') s.add(f[0].replace(/[ˈˌ]/g, '')); } reserved.set(l, s); } }
  return reserved.get(lang)!;
}
const pseudoCache = new Map<string, string>();
/** the pseudo-word for an English word in a language: the same word always gives the same form (keyed by language and word) */
export function pseudoFor(en: string, lang: LangId): string {
  const k = `${lang}|${en}`, c = pseudoCache.get(k); if (c) return c;
  let p = profiles.get(lang); if (!p) { p = buildProfile(lang); profiles.set(lang, p); }
  const r = new Rng(hashString(`rc:${lang}:${en}`) >>> 0, 'reconstruct.pseudo'), res = reservedOf(lang); let w = 'a';
  for (let i = 0; i < 40; i++) { w = pseudoWord(p, r, 3); if (w.length >= 3 && !res.has(w) && speakable(w) && !findModernWords(romanise(w, lang)).length) break; }
  pseudoCache.set(k, w); return w;
}

/** both synthesis paths accept it: the formant tokenizer and the voice model's symbols */
export function speakable(ipa: string): boolean { try { return tokenizeIpa(ipa).length > 0 && toKokoro(ipa).length > 0; } catch { return false; } }

const ROM: readonly (readonly [string, string])[] = [['t͡ʃ', 'c'], ['d͡ʒ', 'j'], ['tˤ', 'ṭ'], ['sˤ', 'ṣ'], ['kʰ', 'kh'], ['pʰ', 'ph'], ['tʰ', 'th'], ['r̩', 'ṛ'],
  ['aː', 'ā'], ['eː', 'ē'], ['iː', 'ī'], ['oː', 'ō'], ['uː', 'ū'], ['ɛː', 'ē'], ['ɔː', 'ō'], ['ʃ', 'š'], ['ħ', 'ḥ'], ['ʕ', 'ʿ'], ['ʔ', 'ʾ'], ['ɡ', 'g'], ['ŋ', 'ng'], ['ɛ', 'e'], ['ɔ', 'o'], ['ː', ''], ['ˈ', ''], ['ˌ', '']];
/** the transliteration of a pseudo-word, in the scholarly style of its language (Aramaic as the lexicon romanises its IPA) */
export function romanise(ipa: string, lang: LangId): string {
  let s = ipa.normalize('NFC');
  if (lang === 'grc') s = s.replace(/y/g, 'u');
  s = s.replace(/j/g, 'y').replace(/x/g, lang === 'bab' ? 'ḫ' : lang === 'grc' ? 'kh' : 'x');
  for (const [a, b] of ROM) s = s.split(a).join(b);
  return s;
}

function wordFor(en: string, lang: LangId): RcWord | null {
  const c = BY_EN.get(en), pos: Pos = c?.pos ?? 'n';
  const slot = c?.f[lang];
  if (typeof slot === 'string') { const u = attestedUnit(lang, slot); if (u) return { en, form: u.translit, ipa: u.ipa, attested: true, src: 'attested', pos }; }
  if (c && (c.pos === 'neg' || c.pos === 'conj' || c.pos === 'pro' || c.pos === 'd' || c.pos === 'adv') && !slot) return null; // a particle the language does not mark here
  for (const w of c ? [en, ...c.en] : [en]) { const u = senses(lang).get(w); if (u) return { en, form: u.translit, ipa: u.ipa, attested: true, src: 'attested', pos }; }
  if (slot && typeof slot !== 'string' && !findModernWords(slot[0], { ipa: true }).length && !findModernWords(slot[1]).length) return { en, form: slot[1], ipa: slot[0], attested: false, src: 'cognate', pos, note: slot[2] };
  const key = c ? c.en[0] : en, ipa = pseudoFor(key, lang);
  return { en, form: romanise(ipa, lang), ipa, attested: false, src: 'rule', pos, note: `reconstructed by ${lang} phonotactics (C)` };
}

/** the word order of a language (C): SOV puts the verbs (with their negation) last; Aramaic puts the verb first or after the
 *  subject; Babylonian and Aramaic put a demonstrative after its noun */
function order(ws: RcWord[], lang: LangId, vso: boolean): RcWord[] {
  let out = ws.slice();
  if (lang === 'bab' || lang === 'arc') for (let i = 0; i < out.length - 1; i++) if (out[i].pos === 'd' && out[i + 1].pos === 'n') { [out[i], out[i + 1]] = [out[i + 1], out[i]]; i++; }
  const isV = (w: RcWord) => w.pos === 'v';
  const groups: RcWord[][] = []; for (const w of out) { const last = groups[groups.length - 1]; if (last && last[last.length - 1].pos === 'neg' && isV(w)) last.push(w); else groups.push([w]); }
  const verbal = (g: RcWord[]) => g.some(isV);
  if (lang === 'op' || lang === 'el' || lang === 'bab') out = [...groups.filter(g => !verbal(g)), ...groups.filter(verbal)].flat();
  else if (lang === 'arc' && vso) { const vi = groups.findIndex(verbal); if (vi > 0) { const [g] = groups.splice(vi, 1); groups.unshift(g); } out = groups.flat(); }
  else out = groups.flat();
  return out;
}

const cache = new Map<string, Reconstructed>();
/** a short English sentence in a language as reconstructed period speech (tier C). The same English gives the same speech in
 *  a language; `seed` only chooses between the language's admissible orders (Aramaic VSO/SVO) and the sentence's tune. */
export function reconstruct(english: string, lang: LangId, seed = 0): Reconstructed {
  const k = `${lang}|${seed}|${english}`, c = cache.get(k); if (c) return c;
  const toks = english.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean).flatMap(t => EXPAND[t] ?? [t]);
  const clauses: RcWord[][] = [[]]; let neg = false;
  for (const t of toks) {
    const concept = BY_EN.get(t);
    if (concept?.pos === 'conj' && clauses[clauses.length - 1].length) clauses.push([]); // a clause each side of 'and': each in its own order
    const ws = clauses[clauses.length - 1];
    if (!concept && FUNCTION.has(t)) continue;
    if (concept?.pos === 'neg') neg = true;
    const w = wordFor(t, lang); if (!w) continue;
    if (ws.length && ws[ws.length - 1].ipa === w.ipa) continue; // (two English words for one form: said once)
    ws.push(w);
  }
  const h = hashString(`${seed}|${english}`) >>> 0, ordered = clauses.flatMap(ws => order(ws, lang, (h & 1) === 1));
  const ipa = ordered.map(w => w.ipa).join(' '), translit = ordered.map(w => w.form).join(' ');
  const intonation = /\?\s*$/.test(english) ? 'rise' : neg || (h >> 3) % 5 ? 'fall' : 'level';
  const out: Reconstructed = { english, lang, ipa, translit, gloss: `${english.replace(/\s+$/, '')} (reconstructed period speech, tier C)`, tier: 'C', words: ordered, intonation };
  cache.set(k, out); return out;
}

/** the reconstructed sentence as a voice unit (audio/voices.ts plays it in the speaker's own voice) */
export function reconstructedUnit(english: string, lang: LangId, seed = 0): Unit {
  const r = reconstruct(english, lang, seed);
  return { id: `rc:${lang}:${(hashString(`${lang}|${seed}|${english}`) >>> 0).toString(36)}`, ipa: r.ipa, intonation: r.intonation, kind: 'line', parts: r.words.map(w => `rc:${lang}:${w.form}`), tier: 'C', gloss: r.gloss, translit: r.translit };
}
