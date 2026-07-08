import { ALWAYS_VISIBLE_REFS, EXCLUDED_FIELD_REFS } from './traceColumnFields';

// Compares a saved per-query per-side column config (e.g. from a favorite) against the
// currently live columns (fresh from ADO) and reports which referenceNames were dropped
// (saved but no longer present) and which were added (present but never saved).
// `fieldsByQuery` shape: { [queryKey]: { [side]: [{ referenceName, name }] } } — see deriveFieldList.
// `queries` shape: { [queryKey]: query } where query.columns is the {referenceName, name}[]
// snapshot captured when the query was selected — the only place we can still recover a dropped
// column's friendly name, since it's no longer in the fresh fetch by definition.
// Dropped entries carry the display label (rename override, else the query's own prior name for
// that column, else referenceName as a last resort) plus which customizations are being
// discarded (renamed / hidden), so the caller can say more than just "a column was removed".
export function describeColumnDrift(fieldsByQuery, queries, fieldOrder, fieldDisplayMapping, fieldVisibility) {
  const droppedByLabel = new Map(); // label -> { wasRenamed, wasHidden }
  const addedByLabel = new Set();

  for (const [queryKey, sides] of Object.entries(fieldsByQuery || {})) {
    const priorNameByRef = new Map((queries?.[queryKey]?.columns || []).map((c) => [c.referenceName, c.name]));

    for (const [side, fields] of Object.entries(sides || {})) {
      const savedRefs = fieldOrder?.[queryKey]?.[side] || [];
      if (savedRefs.length === 0) continue; // no saved config for this side yet

      const currentByRef = new Map((fields || []).map((f) => [f.referenceName, f.name]));
      for (const ref of savedRefs) {
        if (currentByRef.has(ref)) continue;
        // Fields that are deliberately excluded from fieldsByQuery (System.Id, Work Item Type,
        // etc.) will never appear in currentByRef even though ADO didn't actually drop them —
        // a legacy saved entry for one of these (e.g. from before this exclusion existed) is
        // noise, not real drift.
        if (ALWAYS_VISIBLE_REFS.has(ref) || EXCLUDED_FIELD_REFS.has(ref)) continue;

        const override = fieldDisplayMapping?.[queryKey]?.[side]?.[ref];
        const wasHidden = fieldVisibility?.[queryKey]?.[side]?.[ref] === false;
        const label = override || priorNameByRef.get(ref) || ref;
        const existing = droppedByLabel.get(label) || { wasRenamed: false, wasHidden: false };
        droppedByLabel.set(label, {
          wasRenamed: existing.wasRenamed || Boolean(override),
          wasHidden: existing.wasHidden || wasHidden,
        });
      }

      const savedSet = new Set(savedRefs);
      for (const [ref, name] of currentByRef) {
        if (!savedSet.has(ref)) addedByLabel.add(name || ref);
      }
    }
  }

  return {
    dropped: [...droppedByLabel.entries()].map(([label, info]) => ({ label, ...info })),
    added: [...addedByLabel],
  };
}

// True when a drift result has anything worth showing to the user.
export function hasColumnDrift({ dropped, added }) {
  return dropped.length > 0 || added.length > 0;
}

// Removes referenceNames from saved fieldOrder/fieldVisibility/fieldDisplayMapping that no
// longer exist in the live query columns, so a deleted-in-ADO column's stale rename/hide/order
// entry doesn't keep counting as a "pending change" forever. Only prunes sides whose query is
// actually active (queries[queryKey] truthy) and whose columns were actually fetched
// (fieldsByQuery[queryKey] present) — an inactive/unfetched direction's saved config is left
// untouched so re-selecting it later doesn't lose prior customization.
// Identity-stable: returns the original object references when nothing needed pruning.
export function pruneStaleFieldConfig(fieldsByQuery, queries, fieldOrder, fieldVisibility, fieldDisplayMapping) {
  let orderChanged = false;
  let visibilityChanged = false;
  let mappingChanged = false;
  const nextOrder = { ...fieldOrder };
  const nextVisibility = { ...fieldVisibility };
  const nextMapping = { ...fieldDisplayMapping };

  for (const queryKey of ['req-test', 'test-req']) {
    if (!queries?.[queryKey]) continue;
    const sides = fieldsByQuery?.[queryKey];
    if (!sides) continue;

    for (const side of ['Requirement', 'Test Case']) {
      const currentRefs = new Set((sides[side] || []).map((f) => f.referenceName));

      const savedOrder = fieldOrder?.[queryKey]?.[side];
      if (savedOrder && savedOrder.some((ref) => !currentRefs.has(ref))) {
        nextOrder[queryKey] = { ...(nextOrder[queryKey] || {}), [side]: savedOrder.filter((ref) => currentRefs.has(ref)) };
        orderChanged = true;
      }

      const savedVisibility = fieldVisibility?.[queryKey]?.[side];
      if (savedVisibility) {
        const entries = Object.entries(savedVisibility).filter(([ref]) => currentRefs.has(ref));
        if (entries.length !== Object.keys(savedVisibility).length) {
          nextVisibility[queryKey] = { ...(nextVisibility[queryKey] || {}), [side]: Object.fromEntries(entries) };
          visibilityChanged = true;
        }
      }

      const savedMapping = fieldDisplayMapping?.[queryKey]?.[side];
      if (savedMapping) {
        const entries = Object.entries(savedMapping).filter(([ref]) => currentRefs.has(ref));
        if (entries.length !== Object.keys(savedMapping).length) {
          nextMapping[queryKey] = { ...(nextMapping[queryKey] || {}), [side]: Object.fromEntries(entries) };
          mappingChanged = true;
        }
      }
    }
  }

  return {
    fieldOrder: orderChanged ? nextOrder : fieldOrder,
    fieldVisibility: visibilityChanged ? nextVisibility : fieldVisibility,
    fieldDisplayMapping: mappingChanged ? nextMapping : fieldDisplayMapping,
    changed: orderChanged || visibilityChanged || mappingChanged,
  };
}
