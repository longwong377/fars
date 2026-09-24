// Renders a performance off the main thread (D-178): a four-voice chorus of 30 s costs ~0.5 s of synthesis
// (tests/music.test.ts), which would stall a frame. Pure DSP only (music.ts compose/render; song.ts; instruments.ts).
import { compose, render, type Performance } from './music';

self.onmessage = (ev: MessageEvent<{ token: number; p: Performance; seconds: number; sr: number }>) => {
  const { token, p, seconds, sr } = ev.data;
  const t0 = performance.now();
  const pcm = render(p, compose(p, seconds), sr);
  (self as unknown as Worker).postMessage({ token, pcm, sr, ms: performance.now() - t0 }, [pcm.buffer]);
};
