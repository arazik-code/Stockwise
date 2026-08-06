// wa.me click-to-chat links only support pre-filled text - there is no URL parameter that
// pre-attaches an image to a WhatsApp conversation. The practical workaround is to put the image
// on the OS clipboard so the user can paste it (Ctrl+V) straight into the chat that opens.

/** Copy a data: URL image onto the OS clipboard. Returns false if the Clipboard API is unavailable
 *  (e.g. non-secure-context LAN access over plain HTTP) or the browser/user denies it. */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
    const blob = await (await fetch(dataUrl)).blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  } catch {
    return false
  }
}

/** Fallback when clipboard access isn't available: download the image so it can be attached manually. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
