import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes } from './router'
import './style.css'

// ViteSSG replaces the usual `createApp().mount('#app')` pattern with a
// factory. At build time, vite-ssg crawls `routes`, renders each page
// server-side, and writes a real HTML file per route — so search engines
// see the actual content (and our useHead title/meta) instead of an
// empty <div id="app">. The same factory powers the client-side app.
export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
    scrollBehavior() {
      return { top: 0 }
    },
  },
)
