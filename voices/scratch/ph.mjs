import { phonemize } from 'phonemizer';
try {
  console.log(JSON.stringify(await phonemize('Yes, my wife is at home grinding the barley.', 'en-us')));
  console.log(JSON.stringify(await phonemize('سلام، من در مزرعه کار می‌کنم.', 'fa')));
} catch (e) { console.log('ERR', String(e).slice(0, 500)); }
