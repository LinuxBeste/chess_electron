export function copyToClipboard(text: string): Promise<void> {
  if (window.electronAPI?.clipboardWrite) {
    window.electronAPI.clipboardWrite(text);
    return Promise.resolve();
  }
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}
