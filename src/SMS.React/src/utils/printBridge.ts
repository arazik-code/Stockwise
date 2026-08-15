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
//
// window.print() inside that iframe opens a real, OS-level modal print dialog - confirmed by
// reproducing it directly: once open, the tab stops responding to ANY input, including Escape,
// until the dialog is dismissed. That is not a bug in the dialog itself (every browser behaves
// this way; there is no silent-print API on the web platform), but two things around it were:
//
//   1. printFrame was only ever removed at the START of the NEXT print call, never after the
//      current one finished. A second print fired while the first dialog was still open would
//      call .remove() on the very iframe that dialog belongs to.
//   2. Nothing stopped a second call from happening in the first place - a cashier who doesn't
//      realize a system dialog opened (it can appear behind the window, or off the touchscreen's
//      visible area) reads a non-responsive tab as "frozen" and reflexively clicks Imprimer again.
//
// Fixed by (1) an in-flight guard that ignores a re-entrant call while one is still pending, and
// (2) releasing the frame via the `afterprint` event - which fires once the dialog is dismissed,
// printed or cancelled - instead of leaving it parked in the DOM indefinitely.
let printFrame: HTMLIFrameElement | null = null
let printInFlight = false

export function printHtml(html: string): void {
  const webview = (window as unknown as { chrome?: { webview?: { postMessage?: (msg: unknown) => void } } }).chrome?.webview
  if (webview?.postMessage) {
    webview.postMessage({ type: 'print', html })
    return
  }

  if (printInFlight) return
  printInFlight = true

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
    printInFlight = false
    return
  }

  const release = () => {
    printInFlight = false
    if (printFrame === frame) {
      frame.remove()
      printFrame = null
    }
  }

  // afterprint fires once the native dialog closes, whichever way. It is the only reliable signal
  // that printing is done with this frame - there's no promise or callback from window.print().
  frame.contentWindow?.addEventListener('afterprint', release)
  // Backstop: some browsers don't fire afterprint reliably from inside an iframe. Without this, a
  // print the cashier cancelled (rather than completed) would leave printInFlight stuck true
  // forever, silently blocking every later print for the rest of the shift.
  setTimeout(release, 60_000)

  doc.open()
  doc.write(html)
  doc.close()
}

export function isDesktopShell(): boolean {
  return !!(window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview
}
