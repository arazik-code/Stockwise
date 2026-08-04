// Single entry point for every "print this HTML" action in the app.
//
// Inside the desktop shell (FlexShoes Stock.exe), this hands the HTML to the WinForms host via
// chrome.webview.postMessage, which prints it silently on a hidden WebView2 instance straight to
// the OS default printer - no dialog, no extra window. That used to not exist at all: every print
// action opened a visible browser window/tab and needed a manual click, which on a busy POS
// counter looked like "the printer doesn't work".
//
// Outside the shell (e.g. a cashier station opening this app in Firefox over the LAN), there is no
// native bridge, so this falls back to printing through a hidden iframe - the html passed in should
// already include a `<script>window.onload = () => window.print()</script>` for that path to
// trigger itself. A hidden iframe is used instead of window.open(): popup blockers (Firefox's in
// particular) can silently swallow window.open() with no error and no visible sign anything
// happened - on a busy counter that looks exactly like "the printer doesn't work" all over again.
// An iframe isn't a popup, so it can't be blocked that way.
let printFrame: HTMLIFrameElement | null = null

export function printHtml(html: string): void {
  const webview = (window as unknown as { chrome?: { webview?: { postMessage?: (msg: unknown) => void } } }).chrome?.webview
  if (webview?.postMessage) {
    webview.postMessage({ type: 'print', html })
    return
  }

  printFrame?.remove()

  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.style.visibility = 'hidden'
  document.body.appendChild(frame)
  printFrame = frame

  const doc = frame.contentWindow?.document
  if (!doc) {
    frame.remove()
    printFrame = null
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
}

export function isDesktopShell(): boolean {
  return !!(window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview
}
