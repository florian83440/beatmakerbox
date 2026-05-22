<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useEqPlayer, EQ_PRESETS, isCutoffType, type EqPreset, type EqBandState } from '@/composables/useEqPlayer'

useHead({
  title: 'EQ Visualizer — Live 7-band EQ + spectrum analyzer · Beatmakerbox',
  meta: [
    { name: 'description', content: 'Free in-browser 7-band parametric EQ with live spectrum. Drag nodes to shape the curve, presets for HPF, LPF, surgical cuts. No upload, no signup.' },
    { property: 'og:title', content: 'EQ Visualizer — Live 7-band EQ + spectrum analyzer' },
    { property: 'og:description', content: 'Parametric EQ with live spectrum in the browser. Drag the curve, presets included.' },
    { property: 'og:type', content: 'website' },
  ],
})

const TYPE_ABBR: Record<BiquadFilterType, string> = {
  lowpass:    'LPF',
  highpass:   'HPF',
  bandpass:   'BP',
  lowshelf:   'L-Shelf',
  highshelf:  'H-Shelf',
  peaking:    'Peak',
  notch:      'Notch',
  allpass:    'AP',
}

const TYPE_CHOICES: BiquadFilterType[] = ['highpass', 'lowshelf', 'peaking', 'highshelf', 'lowpass', 'notch', 'bandpass']

const eq = useEqPlayer()
const fileName = ref<string | null>(null)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)

const activePresetName = ref<string>('Flat')
const selectedBand = ref<number | null>(null)
const draggingBand = ref<number | null>(null)
const hoveredBand = ref<number | null>(null)

// ---- visual constants ---------------------------------------------------
const F_MIN = 20
const F_MAX = 20000
const LOG_MIN = Math.log10(F_MIN)
const LOG_MAX = Math.log10(F_MAX)
const EQ_DB_RANGE = 18         // ±18 dB visible on the curve axis
const Q_MIN = 0.1
const Q_MAX = 10
const SPEC_DB_MIN = -90
const SPEC_DB_MAX = -10
const HIT_RADIUS_PX = 18

// Reusable buffers, allocated once on canvas resize.
let curveFreqs: Float32Array | null = null
let curveDb: Float32Array | null = null

let rafId: number | null = null

// ---- coordinate helpers --------------------------------------------------
function freqToX(f: number, cssW: number): number {
  return ((Math.log10(f) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * cssW
}
function xToFreq(x: number, cssW: number): number {
  const t = Math.max(0, Math.min(1, x / cssW))
  return Math.pow(10, LOG_MIN + t * (LOG_MAX - LOG_MIN))
}
function dbEqToY(db: number, cssH: number): number {
  return cssH * 0.5 - (db / EQ_DB_RANGE) * (cssH * 0.5)
}
function yToDbEq(y: number, cssH: number): number {
  return ((cssH * 0.5 - y) / (cssH * 0.5)) * EQ_DB_RANGE
}
function specDbToY(db: number, cssH: number): number {
  return ((SPEC_DB_MAX - db) / (SPEC_DB_MAX - SPEC_DB_MIN)) * cssH
}

/**
 * Y position of a band's node on the canvas.
 *  - Gain types (peaking/shelves): Y reflects gain in dB.
 *  - Cutoff types (HPF/LPF/notch/bandpass): Y reflects Q on a log scale
 *    (Q=1 → center, Q=10 → top, Q=0.1 → bottom).
 * Gives every band a meaningful vertical drag target.
 */
function nodeYForBand(band: EqBandState, cssH: number): number {
  if (isCutoffType(band.type)) {
    const clampedQ = Math.max(Q_MIN, Math.min(Q_MAX, band.q))
    const normY = Math.log10(clampedQ)   // -1..1 over [0.1, 10]
    return cssH * 0.5 - normY * (cssH * 0.5)
  }
  return dbEqToY(band.gain, cssH)
}

/**
 * Reverse mapping — turn a Y pixel into the band's primary vertical
 * parameter (gain for gain types, Q for cutoff types).
 */
function paramFromY(band: EqBandState, y: number, cssH: number): { gain?: number; q?: number } {
  if (isCutoffType(band.type)) {
    const normY = (cssH * 0.5 - y) / (cssH * 0.5)        // -1..1
    const q = Math.pow(10, Math.max(-1, Math.min(1, normY)))
    return { q: Math.max(Q_MIN, Math.min(Q_MAX, q)) }
  }
  const gain = yToDbEq(y, cssH)
  return { gain: Math.max(-EQ_DB_RANGE, Math.min(EQ_DB_RANGE, gain)) }
}

// ---- canvas drawing -----------------------------------------------------
function ensureBuffers(width: number): void {
  if (!curveFreqs || curveFreqs.length !== width) {
    curveFreqs = new Float32Array(width)
    curveDb = new Float32Array(width)
    for (let i = 0; i < width; i++) {
      const t = i / (width - 1)
      curveFreqs[i] = Math.pow(10, LOG_MIN + t * (LOG_MAX - LOG_MIN))
    }
  }
}

function drawAll(): void {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return

  // Hi-DPI sizing
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
  }
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx2d.clearRect(0, 0, cssW, cssH)

  ensureBuffers(Math.max(2, Math.floor(cssW)))

  // --- 1. Grid (faint freq + dB lines) ---
  ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx2d.fillStyle = 'rgba(255,255,255,0.22)'
  ctx2d.lineWidth = 1
  ctx2d.font = '10px "General Sans", sans-serif'

  const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
  for (const f of gridFreqs) {
    const x = freqToX(f, cssW)
    ctx2d.beginPath()
    ctx2d.moveTo(x, 0)
    ctx2d.lineTo(x, cssH)
    ctx2d.stroke()
    const label = f >= 1000 ? `${f / 1000}k` : `${f}`
    ctx2d.fillText(label, x + 3, cssH - 4)
  }

  // EQ dB grid: 0, ±6, ±12 lines
  ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'
  for (const db of [-12, -6, 0, 6, 12]) {
    const y = dbEqToY(db, cssH)
    ctx2d.beginPath()
    if (db === 0) ctx2d.strokeStyle = 'rgba(255,255,255,0.12)'
    else ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx2d.moveTo(0, y)
    ctx2d.lineTo(cssW, y)
    ctx2d.stroke()
    ctx2d.fillStyle = db === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)'
    ctx2d.fillText(`${db > 0 ? '+' : ''}${db}`, 4, y - 2)
  }

  // --- 2. Spectrum (faded fill in the background) ---
  const spectrum = eq.isPlaying.value ? eq.getSpectrum() : null
  if (spectrum) {
    const binCount = spectrum.length
    const sampleRate = eq.getSampleRate()
    ctx2d.beginPath()
    ctx2d.moveTo(0, cssH)
    for (let i = 1; i < binCount; i++) {
      const freq = (i * sampleRate) / (binCount * 2)
      if (freq < F_MIN) continue
      if (freq > F_MAX) break
      const x = freqToX(freq, cssW)
      const db = spectrum[i]
      const y = Math.max(0, Math.min(cssH, specDbToY(db, cssH)))
      ctx2d.lineTo(x, y)
    }
    ctx2d.lineTo(cssW, cssH)
    ctx2d.closePath()
    const grad = ctx2d.createLinearGradient(0, 0, 0, cssH)
    grad.addColorStop(0, 'rgba(163,230,53,0.28)')
    grad.addColorStop(1, 'rgba(163,230,53,0.02)')
    ctx2d.fillStyle = grad
    ctx2d.fill()
  }

  // --- 3. EQ response curve ---
  if (curveFreqs && curveDb) {
    eq.getEqCurveDb(curveFreqs, curveDb)

    // Fill between curve and the 0 dB line (cyan above, magenta below)
    ctx2d.beginPath()
    ctx2d.moveTo(0, dbEqToY(0, cssH))
    for (let i = 0; i < curveDb.length; i++) {
      const x = (i / (curveDb.length - 1)) * cssW
      const y = dbEqToY(curveDb[i], cssH)
      ctx2d.lineTo(x, y)
    }
    ctx2d.lineTo(cssW, dbEqToY(0, cssH))
    ctx2d.closePath()
    ctx2d.fillStyle = 'rgba(255,122,26,0.10)'
    ctx2d.fill()

    // Stroke the curve
    ctx2d.beginPath()
    for (let i = 0; i < curveDb.length; i++) {
      const x = (i / (curveDb.length - 1)) * cssW
      const y = dbEqToY(curveDb[i], cssH)
      if (i === 0) ctx2d.moveTo(x, y)
      else ctx2d.lineTo(x, y)
    }
    ctx2d.strokeStyle = '#ff7a1a'
    ctx2d.lineWidth = 2
    ctx2d.stroke()
  }

  // --- 4. Cutoff markers (dashed vertical lines for HPF/LPF/notch/bandpass) ---
  ctx2d.save()
  ctx2d.setLineDash([4, 4])
  ctx2d.lineWidth = 1
  for (let i = 0; i < eq.bands.value.length; i++) {
    const band = eq.bands.value[i]
    if (!isCutoffType(band.type)) continue
    const x = freqToX(band.frequency, cssW)
    ctx2d.strokeStyle = 'rgba(255,122,26,0.35)'
    ctx2d.beginPath()
    ctx2d.moveTo(x, 0)
    ctx2d.lineTo(x, cssH)
    ctx2d.stroke()
  }
  ctx2d.restore()

  // --- 5. Band nodes ---
  for (let i = 0; i < eq.bands.value.length; i++) {
    const band = eq.bands.value[i]
    const x = freqToX(band.frequency, cssW)
    const y = nodeYForBand(band, cssH)
    const isHovered = hoveredBand.value === i || draggingBand.value === i
    const isSelected = selectedBand.value === i
    const radius = isHovered ? 8 : 6

    // Outer ring (selection)
    if (isSelected || isHovered) {
      ctx2d.beginPath()
      ctx2d.arc(x, y, radius + 4, 0, Math.PI * 2)
      ctx2d.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx2d.lineWidth = 1
      ctx2d.stroke()
    }

    // Solid node
    ctx2d.beginPath()
    ctx2d.arc(x, y, radius, 0, Math.PI * 2)
    ctx2d.fillStyle = isHovered ? '#ff8f3f' : '#ff7a1a'
    ctx2d.fill()
    ctx2d.strokeStyle = '#0a0a0a'
    ctx2d.lineWidth = 1.5
    ctx2d.stroke()

    // Index inside
    ctx2d.fillStyle = '#0a0a0a'
    ctx2d.font = 'bold 9px "General Sans", sans-serif'
    ctx2d.textAlign = 'center'
    ctx2d.textBaseline = 'middle'
    ctx2d.fillText(`${i + 1}`, x, y + 0.5)
    ctx2d.textAlign = 'start'
    ctx2d.textBaseline = 'alphabetic'

    // Hover tooltip
    if (isHovered) {
      const tip = isCutoffType(band.type)
        ? `${TYPE_ABBR[band.type]} · ${band.label} · Q ${band.q.toFixed(2)}`
        : `${band.label} · Q ${band.q.toFixed(1)} · ${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)} dB`
      ctx2d.font = '10px "General Sans", sans-serif'
      const tipW = ctx2d.measureText(tip).width + 10
      const tipH = 18
      let tipX = x - tipW / 2
      let tipY = y - radius - 24
      if (tipX < 4) tipX = 4
      if (tipX + tipW > cssW - 4) tipX = cssW - 4 - tipW
      if (tipY < 4) tipY = y + radius + 8
      ctx2d.fillStyle = 'rgba(20,20,20,0.95)'
      ctx2d.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx2d.lineWidth = 1
      ctx2d.fillRect(tipX, tipY, tipW, tipH)
      ctx2d.strokeRect(tipX + 0.5, tipY + 0.5, tipW - 1, tipH - 1)
      ctx2d.fillStyle = '#ececec'
      ctx2d.fillText(tip, tipX + 5, tipY + 12)
    }
  }
}

function startDrawLoop(): void {
  if (rafId !== null) return
  const tick = () => {
    drawAll()
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}
function stopDrawLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
}

// ---- mouse interaction --------------------------------------------------
function getCanvasPos(e: MouseEvent): { x: number; y: number; cssW: number; cssH: number } | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    cssW: rect.width,
    cssH: rect.height,
  }
}

function findNodeNear(x: number, y: number, cssW: number, cssH: number): number | null {
  let best = -1
  let bestDist = HIT_RADIUS_PX * HIT_RADIUS_PX
  for (let i = 0; i < eq.bands.value.length; i++) {
    const band = eq.bands.value[i]
    const bx = freqToX(band.frequency, cssW)
    const by = nodeYForBand(band, cssH)
    const dx = x - bx
    const dy = y - by
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best >= 0 ? best : null
}

function onMouseMove(e: MouseEvent): void {
  const pos = getCanvasPos(e)
  if (!pos) return

  if (draggingBand.value !== null) {
    const band = eq.bands.value[draggingBand.value]
    if (!band) return
    const freq = Math.max(F_MIN, Math.min(F_MAX, xToFreq(pos.x, pos.cssW)))
    eq.setBandFreq(draggingBand.value, freq)

    const param = paramFromY(band, pos.y, pos.cssH)
    if (param.gain !== undefined) {
      eq.setBandGain(draggingBand.value, Math.round(param.gain * 10) / 10)
    }
    if (param.q !== undefined) {
      eq.setBandQ(draggingBand.value, Math.round(param.q * 100) / 100)
    }
    activePresetName.value = 'Custom'
    return
  }

  hoveredBand.value = findNodeNear(pos.x, pos.y, pos.cssW, pos.cssH)
}

function onMouseDown(e: MouseEvent): void {
  const pos = getCanvasPos(e)
  if (!pos) return
  const hit = findNodeNear(pos.x, pos.y, pos.cssW, pos.cssH)
  if (hit !== null) {
    draggingBand.value = hit
    selectedBand.value = hit
    e.preventDefault()
  } else {
    selectedBand.value = null
  }
}

function onMouseUp(): void {
  draggingBand.value = null
}

function onMouseLeave(): void {
  draggingBand.value = null
  hoveredBand.value = null
}

function onWheel(e: WheelEvent): void {
  const pos = getCanvasPos(e)
  if (!pos) return
  const target = hoveredBand.value ?? selectedBand.value
  if (target === null) return
  e.preventDefault()
  const cur = eq.bands.value[target].q
  // Q goes log-ish — small steps near 1, bigger steps far from it.
  const factor = e.deltaY > 0 ? 0.92 : 1.087
  const next = Math.max(Q_MIN, Math.min(Q_MAX, cur * factor))
  eq.setBandQ(target, Math.round(next * 10) / 10)
  activePresetName.value = 'Custom'
}

function onDblClick(e: MouseEvent): void {
  const pos = getCanvasPos(e)
  if (!pos) return
  const hit = findNodeNear(pos.x, pos.y, pos.cssW, pos.cssH)
  if (hit !== null) {
    const band = eq.bands.value[hit]
    // Reset the vertical-drag parameter: gain → 0, or Q → Butterworth 0.707.
    if (isCutoffType(band.type)) {
      eq.setBandQ(hit, 0.707)
    } else {
      eq.setBandGain(hit, 0)
    }
    activePresetName.value = 'Custom'
  } else {
    // Add a new peaking band at the clicked frequency
    const freq = Math.max(F_MIN, Math.min(F_MAX, xToFreq(pos.x, pos.cssW)))
    const gain = Math.max(-EQ_DB_RANGE, Math.min(EQ_DB_RANGE, yToDbEq(pos.y, pos.cssH)))
    const idx = eq.addBand({
      type: 'peaking',
      frequency: freq,
      q: 1.0,
      gain: Math.round(gain * 10) / 10,
    })
    selectedBand.value = idx
    activePresetName.value = 'Custom'
  }
}

// ---- preset application -------------------------------------------------
function applyPreset(preset: EqPreset): void {
  eq.applyPreset(preset)
  activePresetName.value = preset.name
  selectedBand.value = null
}

// ---- file loading -------------------------------------------------------
function pickFile(): void { fileInput.value?.click() }

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const f = target.files?.[0]
  if (!f) return
  error.value = null
  fileName.value = f.name
  try {
    await eq.load(f)
  } catch (e2) {
    error.value = e2 instanceof Error ? e2.message : 'Failed to load file.'
  }
}

function formatTime(t: number): string {
  if (!isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function onSeek(e: Event): void {
  eq.seek(parseFloat((e.target as HTMLInputElement).value))
}

// ---- band readout chip click selects the node --------------------------
function selectBand(i: number): void {
  selectedBand.value = selectedBand.value === i ? null : i
}

function onAddBand(): void {
  const idx = eq.addBand({ type: 'peaking', frequency: 1000, q: 1.0, gain: 0 })
  selectedBand.value = idx
  activePresetName.value = 'Custom'
}

function onRemoveBand(): void {
  if (selectedBand.value === null) return
  const idx = selectedBand.value
  eq.removeBand(idx)
  selectedBand.value = null
  activePresetName.value = 'Custom'
}

function onChangeType(type: BiquadFilterType): void {
  if (selectedBand.value === null) return
  eq.setBandType(selectedBand.value, type)
  activePresetName.value = 'Custom'
}

// ---- selected band display ---------------------------------------------
const selectedInfo = computed(() => {
  if (selectedBand.value === null) return null
  return eq.bands.value[selectedBand.value]
})

watch(() => eq.isPlaying.value, (p) => {
  // Always run the loop while ready — the curve must respond to drags even
  // when paused. When playing, the same loop also reads the live spectrum.
  if (p) startDrawLoop()
})

onMounted(() => {
  eq.audioEl.value = audioRef.value
  startDrawLoop()
})

onBeforeUnmount(() => {
  stopDrawLoop()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
    <header class="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <div class="flex items-center gap-2">
        <span class="chip" style="background: rgba(163,230,53,0.14); border-color: rgba(163,230,53,0.3); color: var(--color-lime);">tool · 03</span>
        <span class="chip">real-time</span>
        <span class="chip">{{ eq.bands.value.length }} bands</span>
      </div>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
        EQ <span class="text-[var(--color-lime)]">Visualizer</span>
      </h1>
      <p class="max-w-xl text-[var(--color-text-soft)]">
        Drag nodes to shape the curve — vertical drag is <em>gain</em> for peaking/shelf bands
        and <em>Q</em> for HPF/LPF/notch. Scroll on any node to fine-tune Q. Double-click empty space
        to add a band. Presets give you HPF, LPF and surgical cuts.
      </p>
    </header>

    <!-- Transport / file toolbar -->
    <div class="panel mb-3 flex flex-wrap items-center gap-3 p-3">
      <button type="button" class="btn-ghost" @click="pickFile">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        {{ fileName ? 'Replace file' : 'Load audio file' }}
      </button>

      <button
        v-if="eq.isReady.value"
        type="button"
        class="btn-primary"
        :style="{ background: 'var(--color-lime)', color: '#0a0a0a' }"
        @click="eq.toggle()"
      >
        <svg v-if="!eq.isPlaying.value" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4l14 8L6 20V4z" />
        </svg>
        <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
        {{ eq.isPlaying.value ? 'Pause' : 'Play' }}
      </button>

      <button type="button" class="btn-ghost" @click="eq.resetEq(); activePresetName = 'Flat'">
        Reset EQ
      </button>

      <p v-if="fileName" class="mono ml-auto truncate text-xs text-[var(--color-text-muted)]">
        {{ fileName }}
      </p>

      <input
        ref="fileInput"
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        class="hidden"
        @change="onFileChange"
      />
    </div>

    <!-- Preset row -->
    <div class="panel mb-3 flex flex-wrap items-center gap-2 p-3">
      <span class="label mr-2">Presets</span>
      <button
        v-for="preset in EQ_PRESETS"
        :key="preset.name"
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
        :class="
          activePresetName === preset.name
            ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/15 text-[var(--color-lime)]'
            : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
        "
        @click="applyPreset(preset)"
      >
        {{ preset.name }}
      </button>
      <span
        v-if="activePresetName === 'Custom'"
        class="ml-1 rounded-md border border-[var(--color-edge)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]"
      >
        Custom
      </span>
    </div>

    <div
      v-if="error"
      class="panel-flat mb-4 border-l-2 border-l-[var(--color-magenta)] px-4 py-3 text-sm text-[var(--color-magenta)]"
    >
      {{ error }}
    </div>

    <!-- Spectrum + EQ canvas -->
    <div class="panel p-4">
      <div class="screen relative">
        <canvas
          ref="canvasEl"
          class="block h-[360px] w-full cursor-crosshair touch-none select-none"
          :class="draggingBand !== null ? '!cursor-grabbing' : (hoveredBand !== null ? '!cursor-grab' : '')"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseLeave"
          @wheel.passive="onWheel"
          @dblclick="onDblClick"
        />
        <div v-if="!eq.isReady.value" class="pointer-events-none absolute inset-2 flex items-end justify-center pb-3">
          <p class="label">Load an audio file to see the post-EQ spectrum</p>
        </div>
      </div>

      <!-- Transport -->
      <div class="mt-3 flex items-center gap-3 px-1">
        <span class="mono w-12 text-xs text-[var(--color-text-muted)]">
          {{ formatTime(eq.currentTime.value) }}
        </span>
        <input
          type="range"
          class="flex-1 accent-[var(--color-lime)]"
          :min="0"
          :max="eq.duration.value || 0"
          :step="0.1"
          :value="eq.currentTime.value"
          :disabled="!eq.isReady.value"
          @input="onSeek"
        />
        <span class="mono w-12 text-right text-xs text-[var(--color-text-muted)]">
          {{ formatTime(eq.duration.value) }}
        </span>
      </div>

      <audio ref="audioRef" class="hidden" preload="metadata" />
    </div>

    <!-- Band readout chips + selected band detail -->
    <div class="panel mt-3 p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="label">Bands</p>
        <p class="mono text-[10px] text-[var(--color-text-muted)]">
          click to select · drag node on canvas to move · scroll to change Q
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="(band, i) in eq.bands.value"
          :key="i"
          type="button"
          class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all"
          :class="
            selectedBand === i
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-[var(--color-text)]'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'
          "
          @click="selectBand(i)"
        >
          <span class="mono text-[10px] text-[var(--color-accent)]">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="mono text-[10px] text-[var(--color-text-muted)]">{{ TYPE_ABBR[band.type] }}</span>
          <span>{{ band.label }}</span>
          <span class="mono text-[10px] text-[var(--color-text-muted)]">Q{{ band.q.toFixed(1) }}</span>
          <span
            v-if="!isCutoffType(band.type)"
            class="mono text-[11px]"
            :class="band.gain > 0
              ? 'text-[var(--color-lime)]'
              : (band.gain < 0 ? 'text-[var(--color-cyan)]' : 'text-[var(--color-text-muted)]')"
          >
            {{ band.gain > 0 ? '+' : '' }}{{ band.gain.toFixed(1) }}
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1 rounded-md border border-dashed border-[var(--color-edge)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          @click="onAddBand"
          title="Add a peaking band at 1 kHz"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Add band
        </button>
      </div>

      <!-- Selected band — detailed numeric edit + type switcher + remove -->
      <div v-if="selectedInfo && selectedBand !== null" class="mt-4 border-t border-[var(--color-edge-soft)] pt-4">
        <div class="grid gap-3 sm:grid-cols-4">
          <div>
            <p class="label !text-[9px]">Type</p>
            <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ TYPE_ABBR[selectedInfo.type] }}</p>
          </div>
          <div>
            <p class="label !text-[9px]">Frequency</p>
            <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ selectedInfo.label }}</p>
          </div>
          <div>
            <p class="label !text-[9px]">Q</p>
            <p class="mono mt-1 text-sm text-[var(--color-text)]">{{ selectedInfo.q.toFixed(2) }}</p>
          </div>
          <div>
            <p class="label !text-[9px]">Gain</p>
            <p
              v-if="!isCutoffType(selectedInfo.type)"
              class="mono mt-1 text-sm"
              :style="{
                color: selectedInfo.gain > 0
                  ? 'var(--color-lime)'
                  : (selectedInfo.gain < 0 ? 'var(--color-cyan)' : 'var(--color-text)')
              }"
            >
              {{ selectedInfo.gain > 0 ? '+' : '' }}{{ selectedInfo.gain.toFixed(1) }} dB
            </p>
            <p v-else class="mono mt-1 text-sm text-[var(--color-text-muted)]">—</p>
          </div>
        </div>

        <!-- Type switcher + remove -->
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <span class="label">Change type</span>
          <button
            v-for="t in TYPE_CHOICES"
            :key="t"
            type="button"
            class="rounded-md border px-2 py-1 text-[11px] font-medium transition-all"
            :class="selectedInfo.type === t
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
              : 'border-[var(--color-edge)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)] hover:bg-[var(--color-surface-3)]'"
            @click="onChangeType(t)"
          >
            {{ TYPE_ABBR[t] }}
          </button>

          <button
            v-if="eq.bands.value.length > 1"
            type="button"
            class="ml-auto rounded-md border border-[var(--color-edge)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-magenta)] hover:bg-[var(--color-magenta)]/10 hover:border-[var(--color-magenta)]/40"
            @click="onRemoveBand"
          >
            × Remove band
          </button>
        </div>
      </div>
    </div>

    <section class="mt-12 grid gap-3 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">01 · real curve</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          The bold curve is the cascade's exact frequency response from <code class="mono text-[var(--color-text)]">BiquadFilter.getFrequencyResponse</code> — every dB you see is real.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">02 · drag, scroll, change type</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          Drag nodes for freq + gain, scroll for Q, double-click empty space to add a band, and switch any band between HPF / LPF / peaking / shelves / notch.
        </p>
      </div>
      <div class="panel p-5">
        <p class="label" style="color: var(--color-lime);">03 · utility presets</p>
        <p class="mt-2 text-sm text-[var(--color-text-soft)]">
          One-click filters that mixing engineers actually use — HPF at 40/80/120 Hz, LPF at 5/10/18 kHz, 50/60 Hz hum notches, surgical mud/harsh/sibilance cuts.
        </p>
      </div>
    </section>
  </div>
</template>
