# Cloud addendum (UD-31): talking on by default, ready within a minute — TOP PRIORITY, before the brief's other tasks

The user (UD-31): "by the end of this session the game will be playable for anyone in their browser with less than a minute
load time (assuming a good gpu) WITH talking to people enabled; you will figure this out no excuses".

You own src/people/converse/** and src/audio/neural/** for this. Today: conversation is behind `?converse`, the LLM choices are
1-1.7 GB (Qwen2.5-1.5B / gemma-2-2b), Kokoro and Whisper are pulled as ~1 GB repos. On a public origin the models already come
from Hugging Face's CDN (models.ts isLocal/appConfig) and the browser caches them.

Do, in order, node-testable where possible (the Vagon session tests in the browser):
1. Talking ON by default: no `?converse` flag; a one-line out-of-world consent/settings entry (menu, English allowed there);
   a WebGPU/VRAM check that falls back gracefully (people still talk in their own voice lines, typed input still works).
2. Smallest models that keep T-E9/T-E10 grounding: default LLM Llama-3.2-1B-q4f16 (438 MB) or smaller (measure
   Qwen2.5-0.5B-Instruct-q4f16_1-MLC if it holds the grounding numbers on the node stand-in); Kokoro: only the single
   quantized ONNX file (q8 or q4, ~80-90 MB) and the voices actually used; ASR: typed input first, Whisper (quantized,
   whisper-tiny/base q8 ~40-80 MB) only when the player turns the mic on. Total talk download target <= 600 MB.
3. Streaming: the models start downloading after the world is shown (never before the first frame), with a priority order
   (LLM first), resumable, cached (Cache API); a person approached before the model is ready answers with a short gesture or
   their own line, never a loading UI in the world.
4. Keep single GPU dispatches short (the 2 s Windows watchdog; prompts <= ~450 tokens).
Push to cloud-s15-depth as you go; the Vagon lead merges and tests in the browser. One DECISIONS line (D-373 or your next).
