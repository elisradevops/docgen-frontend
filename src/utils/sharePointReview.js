// Pure, independently-testable: given the two file lists and which
// relativePaths are currently checked, returns the relativePaths to skip
// during sync. Extracted from SharePointConflictDialog.jsx (which exported
// it alongside its default component export, tripping Vite's
// react-refresh/only-export-components lint rule) into a dedicated utils
// module per this project's convention that utils/ holds pure helpers.
//
// Keyed by relativePath, not name — recursive SharePoint listing permits
// duplicate basenames living in different folders, which a name-only key
// can't tell apart.
export function computeFilesToSkip(conflicts, newFiles, selectedPaths) {
  const allFiles = [...(conflicts || []), ...(newFiles || [])];
  return allFiles.filter((f) => !selectedPaths.includes(f.relativePath)).map((f) => f.relativePath);
}

// Builds the { [relativePath]: docType } map the backend applies before its
// own auto-detection — one entry per selected row that currently has a
// docType chosen (whether that came from auto-detection or the review
// dialog's per-row selector). Unselected rows are skipped entirely, so
// there's nothing to sync them as regardless.
export function computeDocTypeOverrides(conflicts, newFiles, selectedPaths, docTypeByPath) {
  const allFiles = [...(conflicts || []), ...(newFiles || [])];
  const overrides = {};
  allFiles.forEach((f) => {
    if (!selectedPaths.includes(f.relativePath)) return;
    const chosen = docTypeByPath[f.relativePath];
    if (chosen) overrides[f.relativePath] = chosen;
  });
  return overrides;
}

// Splits into uppercase alphanumeric tokens — "STD-template_v2.docx" ->
// ['STD','TEMPLATE','V2']. Token-level (not raw substring) matching is
// what avoids "SRS" false-matching inside "SYSRS" (different whole
// tokens) and "str" false-matching inside "Instructions" (not a token
// boundary at all) — both real failure modes a naive
// `name.includes(type)` check would hit.
function tokenize(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function containsContiguousSubsequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

// Guesses a document type from a filename that carries no folder-derived
// docType (e.g. a flat-folder file) — used only to pre-select a per-row
// Select in the review dialog, never to auto-confirm a sync. Matches a
// valid type's tokens as a contiguous run within the filename's own
// tokens (extension stripped first); when more than one type matches, the
// one with the most tokens wins (a multi-word type is a more specific,
// more confident match than a shorter one contained within it), with
// character length as a tie-break. Returns the caller's own string from
// `validTypes` — never a normalized/uppercased variant — because the
// per-row <Select> does an identity comparison against those exact
// strings; a differently-cased return value would render the Select
// blank despite "having" a value.
export function guessDocTypeFromFilename(fileName, validTypes) {
  const extensionStripped = String(fileName || '').replace(/\.[a-zA-Z0-9]+$/, '');
  const nameTokens = tokenize(extensionStripped);
  if (nameTokens.length === 0) return '';

  let best = null;
  (validTypes || []).forEach((rawType) => {
    const type = String(rawType || '');
    if (!type) return;
    const typeTokens = tokenize(type);
    if (!containsContiguousSubsequence(nameTokens, typeTokens)) return;

    if (
      !best ||
      typeTokens.length > best.tokenCount ||
      (typeTokens.length === best.tokenCount && type.length > best.type.length)
    ) {
      best = { type, tokenCount: typeTokens.length };
    }
  });

  return best ? best.type : '';
}

// Orders review rows so ones needing a Document Type surface first — with
// many rows, the ones needing the user's attention would otherwise be
// scattered through a long flat list. Stable partition: within each group
// (needs-a-type / already-typed), conflicts still come before new files,
// preserving the dialog's original grouping. `docTypeByPath` should be a
// snapshot taken once (e.g. right after the dialog opens and any filename
// guesses have already been applied via guessDocTypeFromFilename) —
// sorting against live state would make a row jump out from under the
// user's cursor the instant they pick its type.
export function orderRowsForReview(conflicts, newFiles, docTypeByPath) {
  const tagged = [
    ...(conflicts || []).map((file) => ({ file, isConflict: true })),
    ...(newFiles || []).map((file) => ({ file, isConflict: false })),
  ];
  const needsType = [];
  const hasType = [];
  tagged.forEach((row) => {
    (docTypeByPath[row.file.relativePath] ? hasType : needsType).push(row);
  });
  return [...needsType, ...hasType];
}
