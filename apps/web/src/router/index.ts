import type { RouteRecordRaw } from 'vue-router'

// Route table — exported as a plain array so vite-ssg can crawl every
// static route at build time and emit a pre-rendered HTML file per page.
//
// Per-route <title> and <meta name="description"> are set inside each
// page component via `useHead()` (so they're baked into the HTML during
// SSG and also update on client-side navigation).
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/Home.vue'),
  },
  {
    path: '/key-finder',
    name: 'key-finder',
    component: () => import('@/pages/KeyFinder.vue'),
  },
  {
    path: '/bpm-finder',
    name: 'bpm-finder',
    component: () => import('@/pages/BpmFinder.vue'),
  },
  {
    path: '/eq-visualizer',
    name: 'eq-visualizer',
    component: () => import('@/pages/EqVisualizer.vue'),
  },
  {
    path: '/metronome',
    name: 'metronome',
    component: () => import('@/pages/Metronome.vue'),
  },
  {
    path: '/note-tuner',
    name: 'note-tuner',
    component: () => import('@/pages/NoteTuner.vue'),
  },
  {
    path: '/sample-chopper',
    name: 'sample-chopper',
    component: () => import('@/pages/SampleChopper.vue'),
  },
  {
    path: '/gain-meter',
    name: 'gain-meter',
    component: () => import('@/pages/GainMeter.vue'),
  },
  {
    path: '/bpm-tap',
    name: 'bpm-tap',
    component: () => import('@/pages/BpmTap.vue'),
  },
  {
    path: '/bit-crusher',
    name: 'bit-crusher',
    component: () => import('@/pages/BitCrusher.vue'),
  },
  {
    path: '/packs',
    name: 'packs',
    component: () => import('@/pages/Packs.vue'),
  },
  {
    path: '/packs/:slug',
    name: 'pack-detail',
    component: () => import('@/pages/PackDetail.vue'),
  },
  {
    path: '/contact',
    name: 'contact',
    component: () => import('@/pages/Contact.vue'),
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/pages/Terms.vue'),
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/pages/Privacy.vue'),
  },
  {
    path: '/legal',
    name: 'legal',
    component: () => import('@/pages/Legal.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]
