// s17 V3: the belly dome's spread over a sample of people (shapeFor): share of each dress with a dome over 3 and 6 cm
import { shapeFor } from '../../src/people/bodyShape';
const roles: [string, string, 'm' | 'f'][] = [['worker', 'porter', 'm'], ['worker', 'mason', 'm'], ['woman', 'grinder', 'f'], ['woman', 'baker', 'f'], ['persian', 'official', 'm'], ['guard', 'guard', 'm'], ['median', 'guard', 'm']];
for (const [dress, role, sex] of roles) { let a = 0, b = 0, n = 2000, s = 0;
  for (let i = 0; i < n; i++) { const sh = shapeFor({ seed: 1000 + i * 7, sex, role, dress }, 1); const d = 0.15 * Math.min(0.6, Math.max(0, 0.22 * (sh.belly - 0.6))); s += d; if (d > 0.03) a++; if (d > 0.06) b++; }
  console.log(dress, role, 'mean cm', (100 * s / n).toFixed(2), '>3cm', (100 * a / n).toFixed(1) + '%', '>6cm', (100 * b / n).toFixed(1) + '%'); }
for (const seed of [24, 21, 36, 13, 54, 22, 51]) { const sh = shapeFor({ seed, sex: seed === 21 || seed === 22 ? 'f' : 'm', role: 'x', dress: 'worker' }, 1); console.log(seed, sh.belly.toFixed(2), sh.fat.toFixed(2)); }
