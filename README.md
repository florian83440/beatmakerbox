# Beatmakerbox

Free in-browser audio tools for beatmakers and producers.
Everything runs **100% in the browser** — no upload, no tracker, no signup.

## Stack

- Vue 3 + Vite + TypeScript
- Tailwind CSS v4
- Web Audio API (native decoding, real-time graphs)
- [fft.js](https://github.com/indutny/fft.js) — pure-JS FFT
- Web Workers for heavy DSP jobs

## Tools

| Tool | Route | Status |
|---|---|---|
| Key Finder | `/key-finder` | ✅ Live |
| BPM Finder | `/bpm-finder` | ✅ Live |
| EQ Visualizer | `/eq-visualizer` | ✅ Live |
| 808 / Note Tuner | `/note-tuner` | 🚧 Planned |
| Mic Tuner | `/mic-tuner` | 🚧 Planned |
| Metronome | `/metronome` | 🚧 Planned |

## Architecture

```
src/
  dsp/                  # Pure TS — no Vue, no DOM beyond AudioContext
    decode.ts           # File → AudioBuffer, mono mixdown, downsampling, slicing
    windowing.ts        # Hann window cache, applyWindow
    fft.ts              # SpectrumAnalyzer (fft.js wrapper)
    notes.ts            # Hz ↔ note ↔ cents, pitch classes
    chroma.ts           # 12-bin chromagram from windowed FFTs
    key.ts              # Krumhansl-Schmuckler key estimation
    envelope.ts         # Spectral-flux onset detection function
    autocorr.ts         # Normalized autocorrelation + parabolic interpolation
    bpm.ts              # BPM pipeline (envelope → autocorr → octave folding)
  composables/          # Vue glue around Web Audio
    useAudioFile.ts     # File → reactive DecodedAudio + mono signal
    useEqPlayer.ts      # <audio> + 7×BiquadFilter chain + AnalyserNode
  components/
    AppHeader.vue       AppFooter.vue
    FileDropzone.vue    # Shared drag-and-drop (tool-tinted accent)
  pages/                # One page = one tool = one route = one SEO target
    Home.vue            KeyFinder.vue    BpmFinder.vue    EqVisualizer.vue
  workers/
    bpm.worker.ts       # Offloads analyzeBpm so the UI stays responsive
  router/
    index.ts            # Per-route title + meta description
```

The DSP layer never imports Vue or the DOM (beyond `AudioContext` /
`OfflineAudioContext`). This makes it trivially testable with Vitest
and safe to move into a Web Worker (as already done for BPM).

## Algorithms

### Key Finder
1. Decode → mono → centered 60-second slice
2. STFT (Hann window, FFT 8192, hop 4096)
3. Map each FFT bin in C2..C7 to one of 12 pitch classes → chromagram
4. Pearson-correlate the L1-normalized chromagram with the 24 rotated
   Krumhansl-Kessler key profiles
5. Output: key + mode + Camelot code + top-3 alternatives

### BPM Finder
1. Decode → mono → centered 90-second slice → downsample to 22050 Hz
2. Spectral flux (FFT 1024, hop 512) → onset function
3. Autocorrelation over lags corresponding to 70-180 BPM
4. Pick top 3 peaks (with exclusion zones), parabolic-interpolate them
5. Octave-fold each candidate into [70, 180] BPM; boost candidates whose
   ×2 or ÷2 also has support in the autocorrelation
6. Runs in a Web Worker so long tracks don't freeze the UI

### EQ Visualizer
- Real-time Web Audio graph: `<audio>` → MediaElementSource →
  7 × BiquadFilter (low-shelf, 5× peaking, high-shelf) → AnalyserNode →
  destination
- Spectrum is sampled **after** the EQ chain — what you see is what you hear
- Log-frequency canvas with dB grid, refreshed via `requestAnimationFrame`

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → dist/
pnpm preview      # serve the build on :3000
pnpm type-check   # vue-tsc --noEmit
```

## Deployment

See [INTEGRATION-VPS-OPS.md](./INTEGRATION-VPS-OPS.md) for the full
integration with [vps-ops](https://github.com/florian83440/vps-ops).

Quick local Docker test:

```bash
cp .env.example .env
# edit BEATMAKERBOX_DOMAIN
docker compose up -d --build
```

## License

Private. All rights reserved.
