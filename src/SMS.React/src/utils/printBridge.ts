// Single entry point for every "print this HTML" action in the app.
//
// Inside the desktop shell (FlexShoes Stock.exe), this hands the HTML to the WinForms host via
// chrome.webview.postMessage, which prints it silently on a hidden WebView2 instance straight to
// the OS default printer - no dialog, no extra window. That used to not exist at all: every print
// action opened a visible browser window/tab and needed a manual click, which on a busy POS
// counter looked like "the printer doesn't work".
//
// Outside the shell (e.g. this app opened from another computer's browser over the LAN), there is
// no native bridge, so this falls back to a plain print window - the html passed in should already
// include a `<script>window.onload = () => window.print()</script>` for that path to trigger itself.
export function printHtml(html: string): void {
  const webview = (window as unknown as { chrome?: { webview?: { postMessage?: (msg: unknown) => void } } }).chrome?.webview
  if (webview?.postMessage) {
    webview.postMessage({ type: 'print', html })
    return
  }

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export function isDesktopShell(): boolean {
  return !!(window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview
}
