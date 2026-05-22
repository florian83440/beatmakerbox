// Encode an AudioBuffer as a 16-bit PCM .wav Blob.
//
// Suitable for downloading rendered patterns from the chopper. Output is
// little-endian, interleaved channels, RIFF/WAVE container with a single
// fmt and data chunk — playable everywhere.

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

function floatToPcm16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample))
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataLength = numFrames * blockAlign
  const totalLength = 44 + dataLength

  const arrayBuffer = new ArrayBuffer(totalLength)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)                  // PCM fmt chunk size
  view.setUint16(20, 1, true)                   // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)                  // bits per sample

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Interleave channels into the payload
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch))

  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, floatToPcm16(channels[ch][i]), true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/** Trigger a browser download for a blob (no-op outside DOM contexts). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the download finishes pulling the bytes.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
