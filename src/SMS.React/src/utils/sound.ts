let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  return ctx
}

function tone(freq: number, durationMs: number, delayMs = 0) {
  const audioCtx = getContext()
  if (!audioCtx) return
  const oscillator = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  oscillator.connect(gain)
  gain.connect(audioCtx.destination)
  oscillator.frequency.value = freq
  oscillator.type = 'sine'
  const startAt = audioCtx.currentTime + delayMs / 1000
  gain.gain.setValueAtTime(0.15, startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000)
  oscillator.start(startAt)
  oscillator.stop(startAt + durationMs / 1000)
}

export function playScanSuccess() {
  tone(880, 90)
}

export function playScanError() {
  tone(220, 150)
  tone(220, 150, 180)
}
