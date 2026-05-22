<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useToolbox, type ToolboxTab } from '@/composables/useToolbox'
import ToolboxGainMeter from '@/components/ToolboxGainMeter.vue'
import ToolboxBpmTap from '@/components/ToolboxBpmTap.vue'
import ToolboxBitCrusher from '@/components/ToolboxBitCrusher.vue'

const tb = useToolbox()

// Panel dimensions
const W = 320
const H_MAX = 560

// ---- drag logic --------------------------------------------------------
const panelEl = ref<HTMLDivElement | null>(null)
const headerEl = ref<HTMLDivElement | null>(null)

let dragging = false
let dragStartX = 0
let dragStartY = 0
let panelStartX = 0
let panelStartY = 0

// Resolve default position (bottom-right, 16px margin) lazily.
function defaultPos(): { x: number; y: number } {
  return {
    x: window.innerWidth  - W - 16,
    y: window.innerHeight - H_MAX - 16,
  }
}

function getPos(): { x: number; y: number } {
  return tb.pos.value ?? defaultPos()
}

function clampPos(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth  - W
  const maxY = window.innerHeight - 60   // allow partial offscreen at bottom
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  }
}

function onMouseDown(e: MouseEvent): void {
  if ((e.target as HTMLElement).closest('button, input, a, audio')) return
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  const p = getPos()
  panelStartX = p.x
  panelStartY = p.y
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  const { x, y } = clampPos(panelStartX + dx, panelStartY + dy)
  tb.setPos(x, y)
}

function onMouseUp(): void { dragging = false }

// Touch drag
let touchId: number | null = null

function onTouchStart(e: TouchEvent): void {
  if ((e.target as HTMLElement).closest('button, input, a, audio')) return
  const touch = e.touches[0]
  touchId = touch.identifier
  dragging = true
  dragStartX = touch.clientX
  dragStartY = touch.clientY
  const p = getPos()
  panelStartX = p.x
  panelStartY = p.y
}

function onTouchMove(e: TouchEvent): void {
  if (!dragging || touchId === null) return
  const touch = Array.from(e.touches).find((t) => t.identifier === touchId)
  if (!touch) return
  const dx = touch.clientX - dragStartX
  const dy = touch.clientY - dragStartY
  const { x, y } = clampPos(panelStartX + dx, panelStartY + dy)
  tb.setPos(x, y)
  e.preventDefault()
}

function onTouchEnd(): void { dragging = false; touchId = null }

// Reposition on window resize so the panel doesn't go off-screen.
function onResize(): void {
  if (!tb.pos.value) return
  const { x, y } = clampPos(tb.pos.value.x, tb.pos.value.y)
  tb.setPos(x, y)
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', onResize)
})

// ---- tabs --------------------------------------------------------------
const tabs: Array<{ id: ToolboxTab; label: string }> = [
  { id: 'gain',    label: 'Gain'    },
  { id: 'bpm',     label: 'BPM'     },
  { id: 'crusher', label: 'Crusher' },
]
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="tb.isOpen.value"
        ref="panelEl"
        class="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-[var(--color-edge)]"
        :style="{
          width: W + 'px',
          maxHeight: H_MAX + 'px',
          left: getPos().x + 'px',
          top: getPos().y + 'px',
          background: 'var(--color-surface)',
          boxShadow: '0 16px 40px -12px rgba(0,0,0,0.6)',
          transformOrigin: 'bottom right',
        }"
      >
        <!-- Drag handle / title bar -->
        <div
          ref="headerEl"
          class="flex shrink-0 cursor-grab items-center justify-between border-b border-[var(--color-edge-soft)] bg-[var(--color-surface-2)] px-3 py-2 select-none active:cursor-grabbing"
          @mousedown="onMouseDown"
          @touchstart.passive="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="flex items-center gap-2">
            <span class="led led-hot"></span>
            <span class="label !text-[9px]">Toolbox</span>
          </div>
          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
            @click="tb.close()"
            title="Close toolbox"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tab bar -->
        <div class="flex shrink-0 border-b border-[var(--color-edge-soft)] bg-[var(--color-surface-2)]/60">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="relative flex-1 px-2 py-2 text-xs font-medium transition-colors"
            :class="tb.activeTab.value === tab.id
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-soft)]'"
            @click="tb.setTab(tab.id)"
          >
            <span>{{ tab.label }}</span>
            <!-- Active indicator -->
            <span
              v-if="tb.activeTab.value === tab.id"
              class="absolute bottom-0 left-2 right-2 h-px rounded-full bg-[var(--color-accent)]"
            />
          </button>
        </div>

        <!-- Tab content — scrollable -->
        <div class="flex-1 overflow-y-auto p-4">
          <KeepAlive>
            <ToolboxGainMeter  v-if="tb.activeTab.value === 'gain'" />
            <ToolboxBpmTap     v-else-if="tb.activeTab.value === 'bpm'" />
            <ToolboxBitCrusher v-else-if="tb.activeTab.value === 'crusher'" />
          </KeepAlive>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
