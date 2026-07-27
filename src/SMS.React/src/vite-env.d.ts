/// <reference types="vite/client" />

interface Chrome {
  webview?: {
    postMessage(msg: unknown): void
  }
}

interface Window {
  chrome?: Chrome
}
