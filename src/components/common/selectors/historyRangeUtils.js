// Shared natural-sort/filter helpers for release/pipeline run history — used
// by ReleaseSelector.jsx, PipelineSelector.jsx, and AutoSvdPanel.jsx so all
// three pick from/filter history the exact same way instead of each keeping
// its own copy of the same logic.
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const compareNamesNatural = (a, b) => nameCollator.compare(String(a?.name ?? ''), String(b?.name ?? ''));
export const compareNamesNaturalDesc = (a, b) => compareNamesNatural(b, a);

/**
 * Runs/releases strictly after `startId`, in the same order a "select end"
 * picker should offer them — mirrors ReleaseSelector.jsx's
 * handleStartPointReleaseSelect / PipelineSelector.jsx's
 * handleStartPointPipelineSelect.
 */
export function filterHistoryAfter(history, startId) {
  return [...history].filter((run) => run.id > startId).sort(compareNamesNatural);
}

/**
 * Runs/releases strictly before `endId` — the symmetric filter for a "select
 * start" picker once an end has already been picked (Auto SVD's Range
 * section allows picking either one first; Manual SVD's selectors don't
 * need this direction since they always pick start before end).
 */
export function filterHistoryBefore(history, endId) {
  return [...history].filter((run) => run.id < endId).sort(compareNamesNaturalDesc);
}
