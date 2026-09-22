// Shared clipboard helper — extracted from the two previously-duplicated
// copies in SelectedInputPopover.jsx and ServiceConnectionsDashboard.jsx.
// Falls back to the deprecated execCommand path for older browsers /
// insecure contexts where navigator.clipboard is unavailable (e.g. Edge 92).
export const copyToClipboard = async (text) => {
  const value = String(text ?? '');
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* empty */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
};
