import ESpeakNg from 'espeak-ng';
const run = async (voice, text) => {
  const es = await ESpeakNg({ arguments: ['--phonout', 'out', '-q', '-b', '1', '--ipa=3', '-v', voice, '-f', 'in.txt'], preRun: [M => M.FS.writeFile('in.txt', text)] });
  return es.FS.readFile('out', { encoding: 'utf8' });
};
for (const [v, t] of [['fa', 'سلام، من در مزرعه کار می‌کنم.'], ['fa', 'زن من در خانه جو آرد می‌کند.'], ['en-us', 'Yes, my wife is at home grinding the barley.']]) {
  const t0 = performance.now(); const r = await run(v, t); console.log(v, JSON.stringify(r), (performance.now() - t0).toFixed(0), 'ms');
}
