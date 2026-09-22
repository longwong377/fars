import { describe, it, expect } from 'vitest';
import { spellWord, toCuneiform, XPA_TRANSLIT } from '../src/lang/oldPersian';
describe('Old Persian orthography (Kent rules)', () => {
  it('spells well-known words as in Kent (sign-by-sign)', () => {
    expect(spellWord('xšâyathiya').join('-')).toBe('XA-SHA-A-YA-THA-I-YA');          // x-š-a-y-θ-i-y (Kent: xa-ša-a-ya-θa-i-ya)
    expect(spellWord('Dârayavahauš').join('-')).toBe('DA-A-RA-YA-VA-HA-U-SHA');       // Kent: da-a-ra-ya-va-ha-u-ša
    expect(spellWord('Auramazdâ').join('-')).toBe('A-U-RA-MA-ZA-DA-A');               // Kent: a-u-ra-ma-za-da-a
    expect(spellWord('baga').join('-')).toBe('BA-GA');
    expect(spellWord('bûmim').join('-')).toBe('BA-U-MI-I-MA');                        // Kent: ba-u-mi-i-ma
    expect(spellWord('duvarthim').join('-')).toBe('DU-U-VA-RA-THA-I-MA');            // Kent: du-u-va-ra-θa-i-ma
  });
  it('renders the full XPa text into the Old Persian block without errors', () => {
    const s = toCuneiform(XPA_TRANSLIT);
    expect([...s].every(ch => { const c = ch.codePointAt(0)!; return c >= 0x103a0 && c <= 0x103d5; })).toBe(true);
    expect([...s].length).toBeGreaterThan(500);
  });
});
