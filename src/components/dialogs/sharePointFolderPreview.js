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
//
// The listing itself is recursive now (files sitting directly at the
// connected root, or nested under a folder whose name isn't a recognized
// doc type, are included too) — so an unrecognized/missing docType is no
// longer a hard block here. The review dialog lets the user manually
// assign a type to any such file before syncing; this function only blocks
// connecting when there's genuinely nothing to sync at all.
const NO_FILES_MESSAGE =
  'No template files (.docx/.dotx) found anywhere under this folder — hover the info icon above the URL field to see the expected layout.';

// The backend appends a synthetic "…and N more folder(s)…" entry with no
// relativePath once its own display cap (25) is hit — the array's own
// length would then undercount (it's capped too), so the true total is
// reconstructed from the named entries plus that note's own number.
function summarizeSkippedFolders(skippedFolders) {
  const skipped = skippedFolders || [];
  const named = skipped.filter((s) => s.relativePath);
  const summaryEntry = skipped.find((s) => !s.relativePath);
  const extraCount = summaryEntry ? parseInt((summaryEntry.reason.match(/(\d+)/) || [])[1], 10) || 0 : 0;
  return { totalCount: named.length + extraCount, named, extraCount };
}

// Appends actionable copy for the two "scan wasn't fully clean" signals the
// backend can report — `truncated` (a safety cap was hit before the whole
// tree could be walked) and `skippedFolders` (one or more folders were
// permission-denied and skipped rather than aborting the scan). Never
// upgrades a status, and never touches `canConnect` — a truncated or
// partially-denied scan is still connectable, it's just flagged so the
// user isn't surprised later by files that were never listed at all.
export function appendScanCaveats(result, { truncated, skippedFolders } = {}) {
  const skipped = skippedFolders || [];
  if (!truncated && skipped.length === 0) return result;

  const parts = [result.message];
  let status = result.status;

  if (truncated) {
    parts.push(
      "Only the first 500 files (or 6 folder levels) were scanned — deeper or additional files weren't included."
    );
    if (status === 'success') status = 'warning';
  }

  if (skipped.length > 0) {
    const { totalCount, named, extraCount } = summarizeSkippedFolders(skipped);
    const shownNames = named.slice(0, 3).map((s) => s.relativePath);
    const more = named.length > shownNames.length || extraCount > 0 ? '…' : '';
    parts.push(
      `${totalCount} folder(s) were skipped because your account can't read them: ${shownNames.join(', ')}${more}`
    );
    if (status === 'success') status = 'warning';
  }

  return { ...result, status, message: parts.join(' ') };
}

export function buildFolderPreviewMessage({ files, documentTypes, truncated, skippedFolders }) {
  const list = files || [];
  const skipped = skippedFolders || [];

  if (list.length === 0) {
    if (skipped.length > 0) {
      // Distinct from a genuinely empty folder — every folder that was
      // reachable turned out to be denied, so "no template files found"
      // would misdiagnose a permissions problem as an empty folder.
      const { totalCount } = summarizeSkippedFolders(skipped);
      return {
        status: 'error',
        canConnect: false,
        message: `No files could be read — ${totalCount} folder(s) were denied. Check your SharePoint permissions.`,
      };
    }
    return { status: 'error', canConnect: false, message: NO_FILES_MESSAGE };
  }

  const validTypes = documentTypes || [];
  if (validTypes.length === 0) {
    // Nothing to validate against — don't block on a judgment we can't make.
    return appendScanCaveats(
      {
        status: 'success',
        canConnect: true,
        message: 'Ready to connect — the full file list with dates and sizes will be shown on the next step.',
      },
      { truncated, skippedFolders }
    );
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
    // Every file sits directly at the connected root, or otherwise carries
    // no parent-folder docType at all — they'll each get an empty type
    // selector in the review dialog for manual mapping.
    return appendScanCaveats(
      {
        status: 'warning',
        canConnect: true,
        message:
          "Found files here, but none are in a recognized template-type subfolder — you'll be able to assign each file's type in the next step.",
      },
      { truncated, skippedFolders }
    );
  }

  const validFound = foundTypes.filter((dt) => validSet.has(dt.toUpperCase()));
  const invalidFound = foundTypes.filter((dt) => !validSet.has(dt.toUpperCase()));

  if (invalidFound.length === 0) {
    return appendScanCaveats(
      {
        status: 'success',
        canConnect: true,
        message: 'Ready to connect — the full file list with dates and sizes will be shown on the next step.',
      },
      { truncated, skippedFolders }
    );
  }

  if (validFound.length > 0) {
    return appendScanCaveats(
      {
        status: 'warning',
        canConnect: true,
        message: `Found files here, but ${invalidFound.join(', ')} ${
          invalidFound.length === 1 ? "isn't" : "aren't"
        } recognized template types — you'll be able to assign a type for those in the next step. ${validFound.join(
          ', '
        )} will sync automatically.`,
      },
      { truncated, skippedFolders }
    );
  }

  return appendScanCaveats(
    {
      status: 'warning',
      canConnect: true,
      message: `Found files under ${invalidFound.join(
        ', '
      )}, but none match a recognized template type — you'll be able to assign each file's type in the next step.`,
    },
    { truncated, skippedFolders }
  );
}
