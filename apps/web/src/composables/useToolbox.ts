// Global toolbox state — singleton shared across all pages.
// The panel is floating + draggable; this composable holds its open/close
// state and position so it persists across route changes.

import { ref } from 'vue'

export type ToolboxTab = 'gain' | 'bpm' | 'crusher'

const isOpen = ref(false)
// Position in viewport px — null means "use default (bottom-right)".
const pos = ref<{ x: number; y: number } | null>(null)
const activeTab = ref<ToolboxTab>('gain')

export function useToolbox() {
  function open(tab?: ToolboxTab) {
    if (tab) activeTab.value = tab
    isOpen.value = true
  }
  function close() { isOpen.value = false }
  function toggle(tab?: ToolboxTab) {
    if (isOpen.value && (!tab || tab === activeTab.value)) {
      isOpen.value = false
    } else {
      open(tab)
    }
  }
  function setTab(tab: ToolboxTab) { activeTab.value = tab }
  function setPos(x: number, y: number) { pos.value = { x, y } }

  return { isOpen, pos, activeTab, open, close, toggle, setTab, setPos }
}
