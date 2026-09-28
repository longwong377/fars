
## D-336 A unique natural voice for every person, in their own period language; an opt-in to hear them in Farsi or English in the same voice (session 12, agent voices; UD-22, UD-18, UD-21; T-E11; Q-924, B190-B192)
- **The user (UD-22):** "shitty voices are unacceptable each person needs their unique voice spoken in whatever language they
  speak and and option to hear farsi or english (in character)". The formant synthesiser (D-245, PLACEHOLDER-QUALITY) is
  replaced for speech everywhere a person is heard: the population's voices within 20 m and the murmur bed to 60 m
  (audio/voices.ts), the far crowd to 400 m (audio/farcrowd.ts: grains of the far talkers' own voices over its murmur), the
  scripted exchanges (audio/speech.ts NeuralBackend first, before the eSpeak clips of six shared voice classes), and the
  conversation's heard reply (people/converse/voice.ts heardReplyNeural, played at the person through the world's graph:
  world.ts sayPcm). The formant stays only as the fallback while the model loads or where it cannot run (flagged in F3), and
  for singing (audio/song.ts: a TTS cannot sing; still PLACEHOLDER).
- **The model: Kokoro-82M v1.0** (hexgrad, Apache-2.0; StyleTTS2 + iSTFTNet, 82 M parameters, phoneme input), in a worker
  (audio/neural/neural_worker.ts; transformers.js on WebGPU, WASM fallback). Chosen over Piper's 904-speaker LibriTTS-R voice
  (English-only phoneme training: the period languages' consonants are untrained symbols there) and MMS-TTS (one speaker per
  language, no way to keep one person's voice across languages): Kokoro was trained on eight languages' IPA, so the lexicon's
  reconstructed IPA maps onto its symbols (audio/neural/kokoro.ts toKokoro: what it has no symbol for is its nearest
  neighbour, C: ħ as h, ʕ as ʔ, emphatic ˤ dropped with its backing on a, r̩ as əɾ, tie bars as its affricates), and its
  voices are 256-float style vectors that blend.
- **A person's voice (audio/neural/identity.ts neuralVoice, C):** from their seed (the save's), sex, age and people: a blend of
  three of the model's style voices of their sex (weights from the seed; children: the women's voices), one of them drawn from
  a "regional colour" pool for their people (the style voices' own trained languages: Hindi/British for the Iranians,
  Spanish/Portuguese for the Semitic peoples, Italian/Spanish/French for the Greeks and Anatolians: C), their vocal-tract
  length (pitch and formants together by resampling: adults 0.94-1.06, older 0.965 x, children 1.34 falling with age), their
  pace (older slower), their level. The same identity speaks their own language and the opt-in's Farsi or English (the style
  is the speaker; the text is what changes), so the person is recognisably the same voice.
- **Default heard world unchanged (§10):** a person speaks the published units of their own language (unitsFor), never joined
  into new sentences; a people without a corpus speaks wordless voice (T-K1a2). **The opt-in (settings.hearIn, default
  'own'; the menu "Hear the people you speak with in"; ?hear=fa|en):** the person's own fenced in-character English reply,
  spoken in English (eSpeak-NG's American English phonemes) or in Farsi (the reply put into Persian, then eSpeak-NG's
  Persian phonemes), in the same voice. The Persian is checked (converse/farsi.ts fenceFa: Persian script only, no digits,
  no modern things, not the site's later names "Takht-e Jamshid" or "Persepolis"; Arabic yeh/kaf normalised); failing it,
  the English is spoken and the panel says so. The Farsi text's route: see the measurements below (FARSI_ROUTE).
- **Runtime:** a per-person, per-unit clip cache (a person says their few hundred units again and again: the clip is theirs,
  this utterance's small pitch and pace variation is the playback rate); priorities (a reply first, the voices within 8 m,
  then 20 m, then the bed, then the far crowd); two units of every person newly in earshot rendered ahead; the bed's grains
  drawn from what is rendered (it never waits on the model); a speaker whose clip is not ready waits, silent, jaw closed (as
  a formant render over budget did); the conversation prefetches the nearest person's lines as the stranger comes within
  6 m, and renders the reply in pieces (sentences, the first cut at its comma) played one after another as they are ready.
- **Tools:** tools/dev/fetch_models.mjs voices (all downloads recorded in research/MODELS_MANIFEST.json; outside git on
  T:/fars-assets-s12/voices/models, served by per-repo junctions under public/models/); tools/dev/voices_eval.ts (T-E11),
  voices_calib.ts (the instruments calibrated), voices_fa_cache.ts, voices_probe.* and farsi_probe.* (GPU probes).
