// Old Persian: transliteration (Kent/Livius style) → native cuneiform signs (U+103A0 block) by Kent's orthographic rules
// (research/LANGUAGES.md). The rule-based spelling is tier C until checked against Kent's sign-by-sign edition.
const SIGN: Record<string, number> = {
  A: 0x103a0, I: 0x103a1, U: 0x103a2, KA: 0x103a3, KU: 0x103a4, GA: 0x103a5, GU: 0x103a6, XA: 0x103a7, CA: 0x103a8, JA: 0x103a9, JI: 0x103aa,
  TA: 0x103ab, TU: 0x103ac, DA: 0x103ad, DI: 0x103ae, DU: 0x103af, THA: 0x103b0, PA: 0x103b1, BA: 0x103b2, FA: 0x103b3, NA: 0x103b4, NU: 0x103b5,
  MA: 0x103b6, MI: 0x103b7, MU: 0x103b8, YA: 0x103b9, VA: 0x103ba, VI: 0x103bb, RA: 0x103bc, RU: 0x103bd, LA: 0x103be, SA: 0x103bf, ZA: 0x103c0,
  SHA: 0x103c1, SSA: 0x103c2, HA: 0x103c3,
};
export const WORD_DIVIDER = String.fromCodePoint(0x103d0);
const CONS: Record<string, string> = { k: 'K', g: 'G', x: 'X', c: 'C', j: 'J', t: 'T', d: 'D', th: 'TH', θ: 'TH', p: 'P', b: 'B', f: 'F', n: 'N', m: 'M', y: 'Y', v: 'V', r: 'R', l: 'L', s: 'S', z: 'Z', š: 'SH', ç: 'SS', h: 'H' };
const HAS_I = new Set(['D', 'M', 'V', 'J']);
const HAS_U = new Set(['K', 'G', 'T', 'D', 'N', 'M', 'R']);
function tokens(word: string): string[] {
  const w = word.toLowerCase().normalize('NFC').replace(/ā/g, 'â').replace(/ī/g, 'î').replace(/ū/g, 'û').replace(/ṛ/g, 'r').replace(/[ui]̯/g, m => m[0]);
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (ch === 't' && w[i + 1] === 'h') { out.push('th'); i++; continue; }
    if ('aâiîuû'.includes(ch) || CONS[ch]) out.push(ch);
  }
  return out;
}
export function spellWord(word: string): string[] {
  const t = tokens(word), signs: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const p = t[i];
    if ('aâiîuû'.includes(p)) { // vowel not consumed by a consonant: initial or second vowel of a diphthong / long vowel
      signs.push(p === 'a' || p === 'â' ? 'A' : p === 'i' || p === 'î' ? 'I' : 'U');
      continue;
    }
    const C = CONS[p], n = t[i + 1];
    if (n === 'a') { signs.push(C + 'A'); i++; }
    else if (n === 'â') { signs.push(C + 'A', 'A'); i++; }
    else if (n === 'i' || n === 'î') { signs.push(HAS_I.has(C) ? C + 'I' : C + 'A', 'I'); i++; }
    else if (n === 'u' || n === 'û') { signs.push(HAS_U.has(C) ? C + 'U' : C + 'A', 'U'); i++; }
    else signs.push(C + 'A'); // consonant without vowel: the inherent-a sign
  }
  return signs.map(s => { if (!(s in SIGN)) throw new Error('no OP sign ' + s + ' in ' + word); return s; });
}
export function toCuneiform(translit: string): string {
  return translit.split(/[\\\s]+/).filter(Boolean).map(w => spellWord(w).map(s => String.fromCodePoint(SIGN[s])).join('')).join(WORD_DIVIDER);
}
/** XPa (Gate of All Nations), Livius/Kent transliteration (research/LANGUAGES.md §3), lines joined; tier A text / B copy. */
export const XPA_TRANSLIT = `baga vazraka Auramazdâ hya imâm bûmim adâ hya avam asmânam adâ hya martiyam adâ hya šiyâtim adâ martiyahyâ hya Xšayâršâm xšâyathiyam akunauš aivam parûnâm xšâyathiyam aivam parûnâm framâtâram adam Xšayâršâ xšâyathiya vazraka xšâyathiya xšâyathiyânâm xšâyathiya dahyûnâm paruv zanânâm xšâyathiya ahyâyâ bûmiyâ vazrakâyâ dûraiy apiy Dârayavahauš xšâyathiyahyâ puça Hâxâmanišiya thâtiy Xšayâršâ xšâyathiya vašnâ Auramazdâhâ imam duvarthim visadahyum adam akunavam vasiy aniyašciy naibam kartam anâ Pârsâ tya adam akunavam utamaiy tya pitâ akunauš tyapatiy kartam vainataiy naibam ava visam vašnâ Auramazdâhâ akumâ thâtiy Xšayâršâ xšâyathiya mâm Auramazdâ pâtuv utamaiy xšaçam utâ tya manâ kartam utâ tyamaiy piça kartam avašciy Auramazdâ pâtuv`;
