// scratch: the DML calibration (unless calib.json is there) and the DML eval, one GPU slot
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const run = c => { console.log('>>', c); execSync(c, { stdio: 'inherit', cwd: 'T:/fars-wt/voices', env: { ...process.env, VOICE_DEVICE: 'dml', ORT_THREADS: '4' } }); };
if (!existsSync('T:/fars-wt/voices/REVIEWS/evidence/s12-voices/calib.json')) run('npx tsx tools/dev/voices_calib.ts');
if (existsSync('T:/fars-assets-s12/voices/eval.go')) run('npx tsx tools/dev/voices_eval.ts --n ' + (process.env.EVAL_N ?? '72') + (process.env.EVAL_OUT ? ' --out ' + process.env.EVAL_OUT : ''));
