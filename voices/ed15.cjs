const fs=require('fs');
let p='T:/fars-wt/voices/tests/defaults.test.ts'; let s=fs.readFileSync(p,'utf8');
const a="  it('D-290: the looped probe lookup is the browser default";
if(!s.includes(a)) throw 'miss';
s=s.replace(a, "  it('D-336 / UD-22: every person speaks in their own natural voice by default (the neural voices on unless ?neural=0), heard in their own period language; the Farsi/English layer off by default', () => {\n    expect(DEFAULT_SETTINGS.hearIn).toBe('own');\n    const w = readFileSync('src/world/world.ts', 'utf8'); expect(w).toMatch(/NP\.get\('neural'\) !== '0'/); expect(w).toMatch(/voices\.neural = neural/);\n    expect(readFileSync('src/people/converse/ui.ts', 'utf8')).toMatch(/export const FARSI_ROUTE: FarsiRoute = '(llm|nllb)'/);\n  });\n" + a);
fs.writeFileSync(p,s); console.log('ok');
