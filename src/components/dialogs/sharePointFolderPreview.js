// Pure logic for turning a Test Connection file listing into a preview
// message — extracted so the "which subfolders matched a real document
// type" comparison is unit-testable without mounting the dialog.
//
// Mirrors the backend's actual validity check (SharePointController.ts's
// isValidTemplateDocType): case-insensitive comparison against the
// document types enabled for this project. documentTypes may be empty
// (e.g. no project selected yet) — in that case we can't judge validity at
// all, so we degrade to "trust the listing" rather than falsely flagging
// every subfolder as unrecognized.
const NO_SUBFOLDERS_MESSAGE =
  "No template-type subfolders found here. Files placed directly in this folder aren't picked up — hover the info icon above the URL field to see the expected layout.";

export function buildFolderPreviewMessage({ files, documentTypes }) {
  const list = files || [];

  if (list.length === 0) {
    return { status: 'error', canConnect: false, message: NO_SUBFOLDERS_MESSAGE };
  }

  const validTypes = documentTypes || [];
  if (validTypes.length === 0) {
    // Nothing to validate against — don't block on a judgment we can't make.
    return {
      status: 'success',
      canConnect: true,
      message: 'Ready to connect — the full file list with dates and sizes will be shown on the next step.',
    };
  }

  const validSet = new Set(validTypes.map((dt) => String(dt || '').toUpperCase()));
  // Keep each subfolder's original casing for display (it's the user's
  // real folder name) — only uppercase for the comparison itself.
  const foundTypes = [];
  const seen = new Set();
  list.forEach((f) => {
    const raw = String(f?.docType || '').trim();
    if (!raw || seen.has(raw.toUpperCase())) return;
    seen.add(raw.toUpperCase());
    foundTypes.push(raw);
  });
  if (foundTypes.length === 0) {
    // Files were returned, but none carried a subfolder-derived docType —
    // e.g. they sit directly at the connected folder's root rather than
    // one level down inside a named subfolder. Same root cause as the
    // empty-listing case above, so use the same message rather than the
    // misleading "none match ()" this would otherwise fall through to.
    return { status: 'error', canConnect: false, message: NO_SUBFOLDERS_MESSAGE };
  }

  const validFound = foundTypes.filter((dt) => validSet.has(dt.toUpperCase()));
  const invalidFound = foundTypes.filter((dt) => !validSet.has(dt.toUpperCase()));

  if (validFound.length > 0 && invalidFound.length === 0) {
    return {
      status: 'success',
      canConnect: true,
      message: 'Ready to connect — the full file list with dates and sizes will be shown on the next step.',
    };
  }

  if (validFound.length > 0 && invalidFound.length > 0) {
    return {
      status: 'warning',
      canConnect: true,
      message: `Found files here, but ${invalidFound.join(', ')} ${
        invalidFound.length === 1 ? "isn't" : "aren't"
      } recognized template types. ${validFound.join(
        ', '
      )} will sync — hover the info icon above for the full list.`,
    };
  }

  return {
    status: 'error',
    canConnect: false,
    message: `Found subfolders here, but none match a recognized template type (${invalidFound.join(
      ', '
    )}). Hover the info icon above the URL field to see the expected layout.`,
  };
}
