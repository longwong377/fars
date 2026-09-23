// Modern-language detector for the language lint (brief §10: "the build fails on any modern-language text or audio that
// would be rendered or played in the world"). Used by tests/language.test.ts and, at runtime, by the crowd-murmur
// generator to reject pseudo-words that happen to spell a modern word.
//
// Method (heuristic, documented honestly): a string is romanised (IPA and scholarly transliteration folded to plain
// ASCII in two ways, e.g. š → "sh" and → "s") and every word is looked up in a curated list of common modern words:
// the most frequent English words, placeholder/developer words, and everyday words and greetings of modern Persian,
// Arabic, Hebrew and major European languages in Latin spelling. Modern scripts (Arabic/Persian, Hebrew, Cyrillic,
// Latin letters in script-only fields, CJK, Devanagari …) are detected by Unicode block. A real ancient word that happens
// to coincide with a modern one (Elamite `hi` 'this', Aramaic `bar` 'son') is allowed only when it comes from its own
// lexicon entry (HOMOGRAPHS below), never as free text.

const ENGLISH = `
the be to of and in that have it for not on with he as you do at this but his by from they we say her she or an will my
one all would there their what so up out if about who get which go me when make can like time no just him know take
people into year your good some could them see other than then now look only come its over think also back after use two
how our work first well way even new want because any these give day most us is was are were been has had did said says
am being does done got made went gone going came saw seen told tell ask asked here where why yes yeah yep nope okay ok
hello hi hey bye goodbye thanks thank please sorry sir madam mister miss mrs mr dear friend king queen god gods lord lady
man men woman women boy girl child children father mother brother sister son daughter wife husband house home water bread
wine beer food eat drink fire stone gold silver horse horses camel city gate road door wall hall palace temple sky earth
sun moon star night morning evening today tomorrow yesterday big small great little old young long short high low left
right north south east west up down open close stop wait walk run sit stand come here there this that these those who whom
whose what when where how much many more less very too again never always sometimes maybe perhaps must should shall may
might can cannot dont doesnt isnt arent wasnt werent wont cant im youre hes shes its were theyre ive youve weve theyll
one two three four five six seven eight nine ten hundred thousand first second third last next
red blue green black white yellow brown grey gray
money coin coins pay buy sell work worker workers job boss soldier guard army war peace love hate help give take bring
put keep let begin end start finish stop try call name word words speak talk tell listen hear see look watch read write
book letter paper pen table chair bed room floor roof window street market shop town village farm field river sea mountain
tree flower grass bird dog cat cow sheep goat pig chicken fish meat milk egg eggs salt oil rice wheat barley apple
fine nice bad best better worse worst sure ready done okay alright wow oh ah uh um hmm ha haha lol
new old same different other another each every all both either neither none nothing something anything everything
someone anyone everyone nobody somebody anybody everybody
test testing tested sample example demo dummy placeholder lorem ipsum dolor amet todo fixme tbd xxx foo bar baz qux
label text string number value undefined null nan true false object error warning debug temp tmp info data file image
`;
const OTHER_MODERN = `
salam salaam salaamu alaikum aleikum alaykum marhaba ahlan shukran shokran inshallah mashallah habibi yalla khalas
shalom toda ken lo boker tov erev lehitraot
merci mersi khoda hafez khodahafez khodafez baleh bale balle nah chetori chetor khubi khoobi khub khoob mamnoon mamnun
lotfan befarmayid befarma agha khanom jan joon doost dust pedar madar baradar khahar pesar dokhtar khane khaneh
shahr darvaze darvazeh sang shah padeshah padshah soltan nan ab abe gusht chai chay sib
man shoma ishan anha inja anja koja kojast chi chera kei kheili kheyli dige hast nist ast budan
ciao grazie prego buongiorno buonasera hola adios gracias amigo amiga senor senora bonjour bonsoir bonne nuit oui non
monsieur madame danke bitte guten tag hallo tschuss ja nein herr frau privet spasibo da nyet
`;

/** words of length ≥ 2 only; single letters (English "a", "I") are too ambiguous to lint on */
export const MODERN_WORDS: ReadonlySet<string> = new Set(
  (ENGLISH + ' ' + OTHER_MODERN).split(/\s+/).map(w => w.trim().toLowerCase()).filter(w => w.length >= 2),
);

const FOLD_SH: Record<string, string> = {
  'š': 'sh', 'ʃ': 'sh', 'θ': 'th', 'ç': 'ch', 'ŋ': 'ng', 'ɡ': 'g', 'ə': 'e', 'ɛ': 'e', 'ħ': 'h', 'ḥ': 'h', 'x': 'kh',
  'ṭ': 't', 'ṣ': 's', 'ś': 's', 'ṛ': 'r', 'ā': 'a', 'ī': 'i', 'ū': 'u', 'ē': 'e', 'ō': 'o', 'â': 'a', 'î': 'i', 'û': 'u',
};
const FOLD_PLAIN: Record<string, string> = { ...FOLD_SH, 'š': 's', 'ʃ': 's', 'θ': 't', 'ç': 'c', 'x': 'x' };
/** IPA-only letters: IPA j is English "y", w stays w */
const IPA_EXTRA: Record<string, string> = { j: 'y' };

/**
 * Romanise a string (IPA or transliteration) to plain lowercase ASCII words. Returns the distinct words across the
 * two foldings. Determinatives in braces ({d}, {DIŠ}) are dropped, ATF syllable hyphens and dots are joined
 * (`ak-ka₄` → `akka`), index digits/subscripts removed, glottal/pharyngeal marks and length marks removed.
 */
export function romanisedWords(s: string, opts: { ipa?: boolean } = {}): string[] {
  const base = s.normalize('NFC').toLowerCase()
    .replace(/\{[^}]*\}/g, '')
    .replace(/[₀-₉0-9]/g, '')
    .replace(/(\p{L})[-.](?=\p{L})/gu, '$1')
    .replace(/[ʾʿʔʕˤːˈˌ̩͡ʼ’']/g, '');
  const out = new Set<string>();
  for (const table of [FOLD_SH, FOLD_PLAIN]) {
    let r = '';
    for (const ch of base) r += (opts.ipa ? IPA_EXTRA[ch] : undefined) ?? table[ch] ?? ch;
    r = r.normalize('NFD').replace(/\p{M}/gu, '');
    for (const w of r.split(/[^a-z]+/)) if (w) out.add(w);
  }
  return [...out];
}

/** Modern words found in a string (romanised). `allow` lists romanised words that are licensed homographs. */
export function findModernWords(s: string, opts: { ipa?: boolean; allow?: ReadonlySet<string> } = {}): string[] {
  const hits: string[] = [];
  for (const w of romanisedWords(s, opts)) if (MODERN_WORDS.has(w) && !opts.allow?.has(w)) hits.push(w);
  return [...new Set(hits)];
}

/** Unicode ranges of the scripts allowed on in-world surfaces (brief §10: period scripts only). */
export const PERIOD_SCRIPTS: Record<string, [number, number][]> = {
  oldPersian: [[0x103a0, 0x103df]],
  cuneiform: [[0x12000, 0x123ff], [0x12400, 0x1247f], [0x12480, 0x1254f]],
  imperialAramaic: [[0x10840, 0x1085f]],
};

/** Modern scripts that must never appear in-world (Arabic covers modern Persian). */
export const MODERN_SCRIPTS: Record<string, [number, number][]> = {
  latin: [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x24f], [0x1e00, 0x1eff]],
  arabicPersian: [[0x600, 0x6ff], [0x750, 0x77f], [0x8a0, 0x8ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]],
  hebrew: [[0x590, 0x5ff]],
  cyrillic: [[0x400, 0x4ff]],
  greekModern: [[0x370, 0x3ff]],
  cjk: [[0x3040, 0x30ff], [0x4e00, 0x9fff], [0xac00, 0xd7af]],
  indic: [[0x900, 0x0dff]],
  digits: [[0x30, 0x39]],
};

const inRanges = (cp: number, rs: [number, number][]) => rs.some(([a, b]) => cp >= a && cp <= b);

/**
 * Characters of a script-only in-world string that are outside the allowed period scripts. Whitespace is allowed.
 * Returns a list like ["U+0041 'A' (latin)"] — empty means clean.
 */
export function nonPeriodChars(s: string, allowed: (keyof typeof PERIOD_SCRIPTS)[]): string[] {
  const ok = allowed.flatMap(k => PERIOD_SCRIPTS[k]);
  const bad = new Set<string>();
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (/\s/.test(ch) || inRanges(cp, ok)) continue;
    const which = Object.entries(MODERN_SCRIPTS).find(([, rs]) => inRanges(cp, rs))?.[0] ?? 'other';
    bad.add(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} '${ch}' (${which})`);
  }
  return [...bad];
}
