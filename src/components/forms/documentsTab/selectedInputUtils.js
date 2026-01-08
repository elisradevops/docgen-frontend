export const beautifyText = (s) => String(s || '').replace(/_-_/g, ' - ').replace(/_/g, ' ').trim();

export const toTitleCaseWords = (s) =>
  String(s || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const labelizeKey = (key) => {
  const k = String(key || '').trim();
  const lowerFirst = k ? k[0].toLowerCase() + k.slice(1) : k;
  const map = {
    docType: 'Document Type',
    context: 'Context',
    template: 'Template',
    queriesRequest: 'Selected Queries',
    selectedQueries: 'Selected Queries',
    rangeType: 'Range Type',
    branchName: 'Branch',
    testPlanId: 'Test Plan',
    testPlanText: 'Test Plan',
    testSuiteArray: 'Suites',
    testSuiteTextList: 'Suites',
    nonRecursiveTestSuiteIdList: 'Suites (IDs)',
    isSuiteSpecific: 'Limit to specific suites',
    prIds: 'Pull Requests',
    queryId: 'Query',
    selectedRelease: 'Release',
    selectedRepo: 'Repository',
    selectedQuery: 'Query',
    selectedBuild: 'Build',
    selectedPipeline: 'Pipeline',
    includeConfigurations: 'Display configuration name',
    includeHierarchy: 'Display test group hierarchy',
    includeTestLog: 'Include test log',
    includeHardCopyRun: 'Generate manual hard-copy run',
    includeAttachments: 'Generate run attachments',
    includeAttachmentContent: 'Include attachment content',
    includeRequirements: 'Generate covered requirements',
    includeCustomerId: 'Include customer ID',
    attachmentType: 'Attachment type',
    runAttachmentMode: 'Evidence by',
    fromText: 'From',
    toText: 'To',
    from: 'From',
    to: 'To',
  };
  if (map[k]) return map[k];
  if (map[lowerFirst]) return map[lowerFirst];
  return toTitleCaseWords(k);
};

export const tryParseJsonString = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return null;
  if (!(raw.startsWith('{') && raw.endsWith('}')) && !(raw.startsWith('[') && raw.endsWith(']'))) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const normalizeEnum = (value) => {
  const s = String(value || '').trim();
  const map = {
    asEmbedded: 'Embedded',
    asLink: 'Link',
    asLinked: 'Link',
    runOnly: 'Run only',
    planOnly: 'Plan only',
    both: 'Both',
    linkedRequirement: 'From linked requirements',
    query: 'From query',
    none: 'No',
    linked: 'From linked items',
    openPcrOnly: 'Open PCR only',
    testOnly: 'Test case only',
    onlyTestCaseResult: 'Test case only',
  };
  return map[s] || s;
};

export const labelizeSelectedFieldToken = (token) => {
  const raw = String(token || '').trim();
  if (!raw) return '';
  const parts = raw.split('@');
  if (parts.length < 2) return toTitleCaseWords(raw);
  const field = parts[0];
  const group = parts.slice(1).join('@');
  const groupClean = group.replace(/Field$/i, '').replace(/Properties$/i, '');
  return `${toTitleCaseWords(field)} (${toTitleCaseWords(groupClean)})`;
};

export const normalizeDisplayValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(normalizeDisplayValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const primary = v?.text ?? v?.title ?? v?.name ?? v?.value ?? v?.key ?? v?.id;
    if (primary != null && String(primary).trim()) return String(primary);
    const keys = Object.keys(v || {});
    if (keys.length === 0) return 'Configured';
    return `Configured (${keys.slice(0, 2).join(', ')}${keys.length > 2 ? ', …' : ''})`;
  }
  return String(v);
};

export const formatControlTitle = (control) => {
  const raw = String(control?.title || control?.type || 'Selection').trim();
  const cleaned = raw.replace(/content[-_ ]?control/gi, '').replace(/^\W+|\W+$/g, '').trim();
  return cleaned ? toTitleCaseWords(cleaned) : 'Selection';
};

export const isAdvancedKey = (key, value) => {
  const k = String(key || '').trim();
  if (!k) return false;
  if (k === 'nonRecursiveTestSuiteIdList') return true;
  if (/IdList$/i.test(k) && Array.isArray(value)) return true;
  if (/Array$/i.test(k) && Array.isArray(value)) return true;
  if (/Id$/i.test(k) && (typeof value === 'string' || typeof value === 'number')) return true;
  return false;
};

export const keyCategory = (key, value) => {
  const k = String(key || '').trim();
  if (k === 'isSuiteSpecific') return 'selection';
  const lk = k.toLowerCase();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const hasQueryKey = Object.keys(value || {}).some((x) => String(x || '').toLowerCase().includes('query'));
    if (lk.includes('request') && (lk.includes('query') || hasQueryKey)) return 'queries';
  }
  if (typeof value === 'boolean') return 'options';
  if (/^(include|enable|allow|replace|flat|is)[A-Z_]/.test(k) || /^(include|enable|allow|replace|flat|is)[a-z_]/.test(k))
    return 'options';
  if (lk.includes('query')) return 'queries';
  return 'selection';
};

export const shouldSkipKeyFactory = (data) => {
  const d = data || {};
  return (k) => {
    const key = String(k || '').trim();
    if (!key) return false;
    if (key === 'from' && String(d?.fromText || '').trim()) return true;
    if (key === 'to' && String(d?.toText || '').trim()) return true;
    if (key === 'testPlanId' && String(d?.testPlanText || '').trim()) return true;
    if (key === 'testSuiteArray' && Array.isArray(d?.testSuiteTextList) && d.testSuiteTextList.length > 0) return true;
    if (/Id$/i.test(key)) {
      const textKey = key.replace(/Id$/i, 'Text');
      if (String(d?.[textKey] || '').trim()) return true;
    }
    if (/Array$/i.test(key)) {
      const textListKey = key.replace(/Array$/i, 'TextList');
      if (Array.isArray(d?.[textListKey]) && d[textListKey].length > 0) return true;
    }
    return false;
  };
};

export const buildControlSections = ({ controlIdx, data }) => {
  const selectionRows = [];
  const queryRows = [];
  const optionRows = [];
  const advancedRows = [];
  const shouldSkipKey = shouldSkipKeyFactory(data);
  const hasQueriesRequest = Object.prototype.hasOwnProperty.call(data || {}, 'queriesRequest');
  const rangeType = String(data?.rangeType || '').trim().toLowerCase();

  for (const [k, v] of Object.entries(data || {})) {
    if (k === 'selectedQueries' && hasQueriesRequest) continue;
    if (shouldSkipKey(k) || v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'string' && !v.trim()) continue;

    const row = {
      key: `${controlIdx}-${k}`,
      rawKey: k,
      label: labelizeKey(k),
      value: v,
    };
    if (k === 'fromText' && rangeType === 'pipeline') row.label = 'From Version';
    if (k === 'toText' && rangeType === 'pipeline') row.label = 'To Version';
    if (k === 'fromText' && rangeType === 'release') row.label = 'From Release';
    if (k === 'toText' && rangeType === 'release') row.label = 'To Release';
    if (isAdvancedKey(k, v)) {
      advancedRows.push(row);
      continue;
    }
    const cat = keyCategory(k, v);
    if (cat === 'queries') queryRows.push(row);
    else if (cat === 'options') optionRows.push(row);
    else selectionRows.push(row);
  }

  return { selectionRows, queryRows, optionRows, advancedRows };
};

export const parseInputSummary = (summary) => {
  const raw = String(summary || '').trim();
  if (!raw) return [];
  const parts = raw
    .split('|')
    .map((p) => String(p || '').trim())
    .filter(Boolean);

  const rows = [];
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const delimiterIdx = part.indexOf(':') >= 0 ? part.indexOf(':') : part.indexOf('=');
    if (delimiterIdx <= 0) {
      rows.push({ key: `free-${idx}`, id: `free-${idx}`, label: '', value: part });
      continue;
    }
    const rawLabel = part.slice(0, delimiterIdx).trim();
    const value = part.slice(delimiterIdx + 1).trim();
    const id = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '');
    rows.push({ key: `${rawLabel}-${idx}`, id, label: labelizeKey(rawLabel), value });
  }
  return rows;
};

export const groupInputSummaryRows = (rows) => {
  const groups = { header: [], selection: [], queries: [], options: [], other: [] };
  for (const row of rows || []) {
    const id = String(row?.id || '');
    const label = String(row?.label || '').toLowerCase();
    const value = String(row?.value || '');
    const isYesNo = value === 'Yes' || value === 'No';

    if (['documenttype', 'context', 'template'].includes(id)) {
      groups.header.push(row);
    } else if (
      id.includes('query') ||
      label.includes('query') ||
      label.includes('system overview') ||
      label.includes('known possible bugs') ||
      label.includes('known bugs')
    ) {
      groups.queries.push(row);
    } else if (isYesNo || id.includes('filters') || label.includes('filters') || id.includes('linked') || label.includes('linked')) {
      groups.options.push(row);
    } else if (row?.label) {
      groups.selection.push(row);
    } else {
      groups.other.push(row);
    }
  }
  return groups;
};
