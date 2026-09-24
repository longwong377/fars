// What a carved panel carries (D-184): the one path from src/data/inscriptions.json to carved characters, used by every
// carving (decor.ts, the Terrace; world/plain/naqsh.ts, Naqsh-e Rustam) and by the tests. Old Persian is the stored sign
// sequence (op_signs: the published sign-by-sign edition, ARIo in CATF, built by tools/build_op_signs.ts), never re-derived
// here; Elamite and Babylonian are the ATF converted sign by sign (tools/build_inscriptions.py), in the edition's lines where
// tools/build_cun_lines.py could cut them (el_lines / bab_lines), without modern word spaces.
import inscriptions from '../data/inscriptions.json';
import { carvedLines } from '../lang/oldPersian';

export type Version = 'op' | 'el' | 'bab';
export interface PanelText { font: 'op' | 'cun'; lines: string[]; lined: boolean }
const INS = inscriptions as Record<string, any>;
/** the carved text of one version of an inscription: its lines of characters and whether they are the inscription's own
 *  lines (the edition's) or a run of text the panel flows; no word spaces in Elamite or Babylonian (the royal texts do not
 *  space words); null if the version does not exist */
export function panelText(id: string, ver: Version): PanelText | null {
  const t = INS[id]; if (!t) return null;
  if (ver === 'op') return t.op_signs?.length ? { font: 'op', lines: carvedLines(t.op_signs), lined: !!t.op_lined } : null;
  const lines: string[] | undefined = t[`${ver}_lines`];
  if (lines?.length) return { font: 'cun', lines, lined: true };
  const s: string = (ver === 'el' ? t.el_cuneiform : t.bab_cuneiform) ?? '';
  return s ? { font: 'cun', lines: [s.replace(/\s+/g, '')], lined: false } : null;
}
/** every inscription id that has a text */
export const inscriptionIds = () => Object.keys(INS).filter(k => k !== '_meta');
