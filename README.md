# models-archive (PĀRSA, session 12)

Every language, speech and voice model the project uses, for sessions that cannot reach Hugging Face (the user's direction,
session 12). Outside the game's code branch; fetch only this branch.

- `models/`   = T:/fars-assets/models (WebLLM MLC models, mlc-libs, ONNX Whisper/Kokoro; layout `<repo>/resolve/main/<file>`,
  served by the dev server at /models/: see research/MODELS_MANIFEST.json and tools/dev/fetch_models.mjs)
- `bake/`     = the CPU bake model (Qwen3-4B-Instruct-2507 Q4_K_M GGUF, Apache-2.0) for tools/bake-cpu/bake.mts
- `voices/`   = the voices agent's downloads (D-336)

Files over 95 MiB are split into `<file>.part00`, `.part01`, ...; `SHA256SUMS` holds the sha256 of each WHOLE file.

    git fetch origin models-archive --depth 1 && git worktree add ../models-archive FETCH_HEAD
    cd ../models-archive && node join.mjs          # rejoins every split file and checks every sha256
