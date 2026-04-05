const normalizeText = (value) => String(value || '').trim();

const toNormalizedId = (value) => normalizeText(value);

const toSafePath = (path) => {
  const trimmed = normalizeText(path);
  return trimmed || 'Shared Queries';
};

export const getPathSegments = (path) => {
  const raw = toSafePath(path);
  return raw
    .split('/')
    .map((segment) => normalizeText(segment))
    .filter((segment) => segment !== '');
};

export const buildHistoricalQueryTree = (queryList = []) => {
  const tree = [];
  const folderMap = new Map();
  const leafIds = new Set();

  queryList.forEach((query) => {
    const queryId = toNormalizedId(query?.id);
    if (!queryId || leafIds.has(queryId)) return;

    const queryName = normalizeText(query?.queryName || queryId);
    const queryPath = toSafePath(query?.path);
    const segments = getPathSegments(queryPath);

    let currentChildren = tree;
    let parentId = null;
    let folderKey = '';

    for (const segment of segments) {
      folderKey = folderKey ? `${folderKey}/${segment}` : segment;
      let folderNode = folderMap.get(folderKey);
      if (!folderNode) {
        folderNode = {
          id: `folder:${folderKey}`,
          pId: parentId,
          value: `folder:${folderKey}`,
          title: segment,
          children: [],
          isValidQuery: false,
        };
        folderMap.set(folderKey, folderNode);
        currentChildren.push(folderNode);
      }
      currentChildren = folderNode.children;
      parentId = folderNode.id;
    }

    currentChildren.push({
      id: queryId,
      pId: parentId,
      value: queryId,
      title: queryName || queryId,
      path: queryPath,
      isValidQuery: true,
    });
    leafIds.add(queryId);
  });

  return tree;
};

const toQueryListFromArray = (items = []) => {
  const seen = new Set();
  const mapped = [];
  items.forEach((item) => {
    const id = toNormalizedId(item?.id || item?.key || item?.value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    mapped.push({
      id,
      queryName: normalizeText(item?.queryName || item?.name || item?.title || id),
      path: toSafePath(item?.path || item?.queryPath),
    });
  });
  mapped.sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    if (byPath !== 0) return byPath;
    return a.queryName.localeCompare(b.queryName);
  });
  return mapped;
};

const collectRoots = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;

  const acquiredTrees = payload?.acquiredTrees;
  const explicitTree = payload?.historicalQueryTree ?? acquiredTrees?.historicalQueryTree;

  if (Array.isArray(explicitTree)) return explicitTree;
  if (explicitTree && typeof explicitTree === 'object') return [explicitTree];

  if (Array.isArray(acquiredTrees)) return acquiredTrees;
  if (acquiredTrees && typeof acquiredTrees === 'object') {
    return Object.values(acquiredTrees).filter((value) => value && typeof value === 'object');
  }

  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.value)) return payload.value;

  const looksLikeTreeNode =
    Array.isArray(payload?.children) ||
    payload?.isValidQuery === true ||
    payload?.isFolder === true ||
    typeof payload?.id !== 'undefined';
  return looksLikeTreeNode ? [payload] : [];
};

const isLeafQueryNode = (node) => {
  if (!node || typeof node !== 'object') return false;
  if (node.isValidQuery === true) return true;

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (hasChildren) return false;
  if (node.isFolder === true) return false;

  const id = toNormalizedId(node.id || node.key || node.value);
  return id !== '';
};

const folderSegmentLabel = (node) =>
  normalizeText(node?.title || node?.name || node?.text || node?.value || '');

export const mapHistoricalQueriesFromSharedTree = (sharedPayload) => {
  if (Array.isArray(sharedPayload)) {
    return toQueryListFromArray(sharedPayload);
  }

  const roots = collectRoots(sharedPayload);
  if (roots.length === 0) return [];

  const seen = new Set();
  const items = [];

  const walk = (node, parentSegments = []) => {
    if (!node || typeof node !== 'object') return;

    if (isLeafQueryNode(node)) {
      const id = toNormalizedId(node.id || node.key || node.value);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const fallbackName = folderSegmentLabel(node);
      items.push({
        id,
        queryName: fallbackName || id,
        path: parentSegments.length > 0 ? parentSegments.join('/') : 'Shared Queries',
      });
      return;
    }

    const title = folderSegmentLabel(node);
    const nextSegments = title ? [...parentSegments, title] : parentSegments;
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => walk(child, nextSegments));
  };

  roots.forEach((root) => walk(root, []));
  return toQueryListFromArray(items);
};

export const normalizeWorkItemColor = (rawColor) => {
  if (typeof rawColor !== 'string') return null;
  const trimmed = rawColor.trim();
  if (!trimmed) return null;

  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed.length === 9 ? `#${trimmed.slice(1, 7)}` : trimmed;
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^[0-9a-fA-F]{8}$/.test(trimmed)) return `#${trimmed.slice(0, 6)}`;
  return trimmed;
};

export const getWorkItemIconUrl = (iconValue) => {
  if (!iconValue) return null;
  if (typeof iconValue === 'string') return iconValue;
  if (typeof iconValue === 'object') return iconValue.dataUrl || iconValue.url || iconValue.href || null;
  return null;
};

export const isSameOrigin = (url, locationHref) => {
  if (typeof url !== 'string') return false;
  if (url.startsWith('data:')) return true;

  const baseHref =
    locationHref ||
    (typeof window !== 'undefined' && window?.location?.href ? window.location.href : 'http://localhost');
  try {
    const absolute = new URL(url, baseHref);
    return absolute.origin === new URL(baseHref).origin;
  } catch {
    return false;
  }
};

const toCount = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeAsOfRow = (row = {}) => ({
  id: row.id ?? row.workItemId ?? '',
  workItemType: row.workItemType || row.type || '',
  title: row.title || '',
  state: row.state || '',
  areaPath: row.areaPath || '',
  iterationPath: row.iterationPath || '',
  versionId: row.versionId ?? row.revisionId ?? row.rev ?? '',
  versionTimestamp: row.versionTimestamp || row.changedDate || row.versionDate || '',
  workItemUrl: row.workItemUrl || row.url || row.htmlUrl || '',
});

export const normalizeHistoricalAsOfResult = (payload) => {
  const rowsRaw = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const rows = rowsRaw.map((row) => normalizeAsOfRow(row));
  return {
    queryId: payload?.queryId || '',
    queryName: payload?.queryName || '',
    teamProject: payload?.teamProject || payload?.teamProjectName || '',
    asOf: payload?.asOf || payload?.asOfTimestamp || '',
    total: toCount(payload?.total ?? payload?.totalCount, rows.length),
    skippedWorkItemsCount: toCount(payload?.skippedWorkItemsCount, 0),
    rows,
  };
};

const toNormalizedStatus = (value) => {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'added') return 'Added';
  if (raw === 'deleted') return 'Deleted';
  if (raw === 'changed') return 'Changed';
  if (raw === 'no changes' || raw === 'no-change' || raw === 'nochange') return 'No changes';
  return value || '';
};

const normalizeCompareRow = (row = {}) => ({
  id: row.id ?? row.workItemId ?? '',
  workItemType: row.workItemType || row.type || '',
  title: row.title || '',
  baselineRevisionId: row.baselineRevisionId ?? row.baselineRevision ?? row.baselineVersionId ?? null,
  compareToRevisionId: row.compareToRevisionId ?? row.compareRevision ?? row.compareToVersionId ?? null,
  compareStatus: toNormalizedStatus(row.compareStatus || row.status || ''),
  changedFields: Array.isArray(row.changedFields) ? row.changedFields : [],
  differences: Array.isArray(row.differences) ? row.differences : [],
  workItemUrl: row.workItemUrl || row.url || row.htmlUrl || '',
});

export const normalizeHistoricalCompareResult = (payload) => {
  const rowsRaw = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const detailsById = new Map();
  if (Array.isArray(payload?.details)) {
    payload.details.forEach((detail) => {
      const id = toNormalizedId(detail?.id || detail?.workItemId);
      if (!id) return;
      const existing = detailsById.get(id) || [];
      existing.push({
        field: detail?.field || '',
        baseline: detail?.baseline ?? '',
        compareTo: detail?.compareTo ?? '',
      });
      detailsById.set(id, existing);
    });
  }

  const rows = rowsRaw.map((row) => {
    const mapped = normalizeCompareRow(row);
    const key = toNormalizedId(mapped.id);
    if (mapped.differences.length === 0 && detailsById.has(key)) {
      mapped.differences = detailsById.get(key);
    }
    return mapped;
  });

  const summaryFromRows = rows.reduce(
    (acc, row) => {
      if (row.compareStatus === 'Added') acc.addedCount += 1;
      else if (row.compareStatus === 'Deleted') acc.deletedCount += 1;
      else if (row.compareStatus === 'Changed') acc.changedCount += 1;
      else acc.noChangeCount += 1;
      return acc;
    },
    { addedCount: 0, deletedCount: 0, changedCount: 0, noChangeCount: 0 },
  );

  const summary = payload?.summary
    ? {
        addedCount: toCount(payload.summary.addedCount, summaryFromRows.addedCount),
        deletedCount: toCount(payload.summary.deletedCount, summaryFromRows.deletedCount),
        changedCount: toCount(payload.summary.changedCount, summaryFromRows.changedCount),
        noChangeCount: toCount(payload.summary.noChangeCount, summaryFromRows.noChangeCount),
        updatedCount: toCount(
          payload.summary.updatedCount,
          toCount(payload?.updatedCount, summaryFromRows.changedCount),
        ),
      }
    : {
        ...summaryFromRows,
        updatedCount: toCount(payload?.updatedCount, summaryFromRows.changedCount),
      };

  return {
    queryId: payload?.queryId || '',
    queryName: payload?.queryName || '',
    teamProject: payload?.teamProject || payload?.teamProjectName || '',
    baseline: {
      asOf: payload?.baseline?.asOf || payload?.baselineTimestamp || '',
      total: toCount(payload?.baseline?.total ?? payload?.baselineCount, 0),
    },
    compareTo: {
      asOf: payload?.compareTo?.asOf || payload?.compareToTimestamp || '',
      total: toCount(payload?.compareTo?.total ?? payload?.compareToCount, 0),
    },
    skippedWorkItems: {
      baselineCount: toCount(payload?.skippedWorkItems?.baselineCount, 0),
      compareToCount: toCount(payload?.skippedWorkItems?.compareToCount, 0),
      totalDistinct: toCount(payload?.skippedWorkItems?.totalDistinct, 0),
    },
    summary,
    rows,
  };
};
