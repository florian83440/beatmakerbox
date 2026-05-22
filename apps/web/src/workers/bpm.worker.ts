/// <reference lib="WebWorker" />

// Web Worker — runs BPM analysis off the main thread.
//
// The worker receives an already-decoded mono Float32Array (transferable)
// because decodeAudioData requires a real AudioContext, which only exists
// on the main thread.

import { analyzeBpm, type BpmOptions, type BpmResult } from '@beatmakerbox/dsp'

declare const self: DedicatedWorkerGlobalScope

export interface BpmWorkerRequest {
  id: number
  signal: Float32Array
  sampleRate: number
  options?: BpmOptions
}

export interface BpmWorkerResponse {
  id: number
  result?: Omit<BpmResult, 'durationMs'> & { durationMs: number }
  error?: string
}

self.addEventListener('message', (event: MessageEvent<BpmWorkerRequest>) => {
  const { id, signal, sampleRate, options } = event.data
  const t0 = performance.now()
  try {
    const result = analyzeBpm(signal, sampleRate, options)
    const response: BpmWorkerResponse = {
      id,
      result: { ...result, durationMs: performance.now() - t0 },
    }
    self.postMessage(response)
  } catch (e) {
    const response: BpmWorkerResponse = {
      id,
      error: e instanceof Error ? e.message : String(e),
    }
    self.postMessage(response)
  }
})
