// Pure, independently-testable: given the two file lists and which names are
// currently checked, returns the names to skip during sync. Extracted from
// SharePointConflictDialog.jsx (which exported it alongside its default
// component export, tripping Vite's react-refresh/only-export-components
// lint rule) into a dedicated utils module per this project's convention
// that utils/ holds pure helpers.
export function computeFilesToSkip(conflicts, newFiles, selectedNames) {
  const allFiles = [...(conflicts || []), ...(newFiles || [])];
  return allFiles.filter((f) => !selectedNames.includes(f.name)).map((f) => f.name);
}
