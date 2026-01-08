import React, { useMemo } from 'react';
import { Button, Popover, Tag } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import {
  beautifyText,
  buildControlSections,
  formatControlTitle,
  groupInputSummaryRows,
  labelizeKey,
  labelizeSelectedFieldToken,
  normalizeDisplayValue,
  normalizeEnum,
  parseInputSummary,
  tryParseJsonString,
} from './selectedInputUtils';

const copyToClipboard = async (text) => {
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

const looksLikeIso = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(String(s || '').trim());

const formatIsoAsUi = (raw) => {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(d)
      .replace(',', '');
  } catch {
    return raw;
  }
};

const ObjectValueCard = ({ value, primaryOf }) => {
  const highlightPairs = useMemo(() => {
    const obj = value || {};
    return Object.entries(obj)
      .filter(([, v]) => {
        if (v == null) return false;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true;
        if (typeof v === 'object' && !Array.isArray(v)) return !!primaryOf(v);
        return false;
      })
      .map(([k, v]) => {
        const rendered =
          typeof v === 'boolean'
            ? v
              ? 'Yes'
              : 'No'
            : typeof v === 'object'
            ? primaryOf(v) || ''
            : normalizeEnum(String(v));
        const renderedStr = String(rendered || '').trim();
        if (!renderedStr) return null;
        if (renderedStr.length > 120) return null;
        return { label: labelizeKey(k), value: renderedStr };
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [primaryOf, value]);

  const keyCount = Object.keys(value || {}).length;
  const keySummary = keyCount ? `${keyCount} field${keyCount === 1 ? '' : 's'}` : 'Details';

  return (
    <div style={{ minWidth: 0, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fbfbfd', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 700 }}>{keySummary}</div>
      </div>
      {highlightPairs.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', columnGap: 12, rowGap: 8, alignItems: 'start' }}>
          {highlightPairs.map((p) => (
            <React.Fragment key={`${p.label}-${p.value}`}>
              <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>{p.label}</div>
              <div style={{ minWidth: 0, wordBreak: 'break-word', lineHeight: 1.35 }}>{p.value}</div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ color: '#6b7280', fontSize: 12 }}>No details</div>
      )}
    </div>
  );
};

const valueCell = (value, { rowKey } = {}) => {
  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value);
    if (parsed != null) return valueCell(parsed, { rowKey });

    const asBool =
      value.trim().toLowerCase() === 'true' ? true : value.trim().toLowerCase() === 'false' ? false : null;
    if (asBool !== null) return valueCell(asBool, { rowKey });

    const normalized = normalizeEnum(value);
    if (looksLikeIso(normalized)) {
      return (
        <div title={normalized} style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>
          {formatIsoAsUi(normalized)}
        </div>
      );
    }
    return (
      <div
        title={normalized}
        style={{
          wordBreak: 'break-word',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 4,
          lineHeight: 1.35,
        }}
      >
        {normalized}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <Tag color={value ? 'green' : 'default'} style={{ marginInlineStart: 0, borderRadius: 999, padding: '0 10px', lineHeight: '22px' }}>
        {value ? 'Yes' : 'No'}
      </Tag>
    );
  }

  if (Array.isArray(value)) {
    const rawRowKey = String(rowKey || '').toLowerCase();
    const isSelectedFields = rawRowKey === 'selectedfields' || rawRowKey.endsWith('.selectedfields') || rawRowKey.includes('selectedfields');
    const isAllStrings = value.every((v) => typeof v === 'string' && String(v).trim());
    const items = isSelectedFields && isAllStrings ? value.map(labelizeSelectedFieldToken).filter(Boolean) : value.map(normalizeDisplayValue).filter(Boolean);
    if (items.length === 0) return null;
    const count = items.length;
    const preview = items.slice(0, 2).join(', ');
    const needsCollapsible = count > 6;
    return (
      <div style={{ minWidth: 0 }}>
        <details open={!needsCollapsible}>
          <summary style={{ cursor: 'pointer', color: '#374151' }}>
            {count} selected{preview ? ` — ${preview}${count > 2 ? ', …' : ''}` : ''}
          </summary>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, maxHeight: 140, overflowY: 'auto' }}>
            {items.map((t, idx) => (
              <Tag key={`${t}-${idx}`} style={{ marginInlineEnd: 0 }}>
                {t}
              </Tag>
            ))}
          </div>
        </details>
      </div>
    );
  }

  if (value && typeof value === 'object') {
    const rawKey = String(rowKey || '').toLowerCase();
    const selectionObjectKeys = new Set([
      'selectedpipeline',
      'selectedbuild',
      'selectedrelease',
      'selectedrepo',
      'selectedquery',
    ]);
    if (selectionObjectKeys.has(rawKey)) {
      const text = value?.text ?? value?.title ?? value?.name ?? value?.value ?? '';
      const key = value?.key ?? value?.id ?? value?.pId ?? '';
      const textStr = String(text || '').trim();
      const keyStr = String(key || '').trim();
      if (textStr && keyStr && !textStr.includes(keyStr)) {
        return <div style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>{`${textStr} (#${keyStr})`}</div>;
      }
      if (textStr) return <div style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>{textStr}</div>;
      if (keyStr) return <div style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>{`#${keyStr}`}</div>;
    }
    const primaryOf = (v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
      const primary = v?.text ?? v?.title ?? v?.name ?? v?.value ?? v?.key ?? v?.id;
      if (primary == null) return null;
      if (typeof primary === 'boolean') return primary ? 'Yes' : 'No';
      const s = String(primary).trim();
      return s ? normalizeEnum(s) : null;
    };
    return <ObjectValueCard value={value} primaryOf={primaryOf} />;
  }

  const raw = String(value || '');
  if (looksLikeIso(raw)) return <div style={{ lineHeight: 1.35 }}>{formatIsoAsUi(raw)}</div>;
  return <div style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>{raw}</div>;
};

export const SelectedInputPopoverContent = ({ inputSummary, inputDetails }) => {
  const sectionTitleStyle = useMemo(
    () => ({
      fontSize: 12,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      margin: '12px 0 8px',
    }),
    []
  );

  const controlTitleStyle = useMemo(
    () => ({
      fontSize: 13,
      fontWeight: 800,
      color: '#374151',
      letterSpacing: 0.2,
      margin: '14px 0 10px',
    }),
    []
  );

  const gridStyle = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: '220px minmax(0, 1fr)',
      columnGap: 14,
      rowGap: 10,
      alignItems: 'start',
    }),
    []
  );

  const labelStyle = useMemo(() => ({ fontWeight: 600, color: '#4b5563' }), []);

  const renderKVRows = (items) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={gridStyle}>
        {items.map((r) => (
          <React.Fragment key={r.key}>
            <div style={labelStyle}>{r.label || ' '}</div>
            <div style={{ minWidth: 0 }}>{valueCell(r.value, { rowKey: r.rawKey || r.id || r.label })}</div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const parsedDetails = useMemo(() => {
    if (!inputDetails) return null;
    if (typeof inputDetails === 'object') return inputDetails;
    const parsed = tryParseJsonString(inputDetails);
    return parsed && typeof parsed === 'object' ? parsed : null;
  }, [inputDetails]);

  if (parsedDetails && typeof parsedDetails === 'object') {
    const headerRows = [
      { key: 'docType', label: 'Document Type', value: parsedDetails?.docType ?? '' },
      { key: 'context', label: 'Context', value: beautifyText(parsedDetails?.contextName ?? '') },
      { key: 'template', label: 'Template', value: parsedDetails?.template?.name ?? '' },
    ].filter((r) => String(r.value || '').trim());

    const controls = Array.isArray(parsedDetails?.contentControls) ? parsedDetails.contentControls : [];

    return (
      <div style={{ minWidth: 360, maxWidth: 760 }}>
        <div style={{ maxHeight: 420, overflow: 'auto', paddingRight: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.4 }}>Full snapshot (no truncation).</div>
            <Button size='small' onClick={() => copyToClipboard(JSON.stringify(parsedDetails, null, 2))}>
              Copy JSON
            </Button>
          </div>

          {renderKVRows(headerRows)}

          {controls.map((control, idx) => {
            const title = formatControlTitle(control);
            const data = control?.data && typeof control.data === 'object' ? control.data : {};

            const { selectionRows, queryRows, optionRows, advancedRows } = buildControlSections({ controlIdx: idx, data });
            const hasAny = selectionRows.length || queryRows.length || optionRows.length || advancedRows.length;
            if (!hasAny) return null;

            return (
              <div key={`${title}-${idx}`}>
                <div style={controlTitleStyle}>{title}</div>
                {selectionRows.length ? renderKVRows(selectionRows) : null}
                {queryRows.length ? (
                  <div>
                    <div style={sectionTitleStyle}>Queries</div>
                    {renderKVRows(queryRows)}
                  </div>
                ) : null}
                {optionRows.length ? (
                  <div>
                    <div style={sectionTitleStyle}>Options</div>
                    {renderKVRows(optionRows)}
                  </div>
                ) : null}
                {advancedRows.length ? (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}>Advanced</summary>
                    <div style={{ marginTop: 10 }}>{renderKVRows(advancedRows)}</div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: parse summary string (older docs / metadata-only)
  const rows = parseInputSummary(inputSummary);
  const groups = groupInputSummaryRows(rows);
  const hasSelection = groups.selection.length > 0;
  const hasQueries = groups.queries.length > 0;
  const hasOptions = groups.options.length > 0;
  const hasOther = groups.other.length > 0;
  const mightBeTruncated = /\(\+\d+\)/.test(String(inputSummary || ''));

  return (
    <div style={{ minWidth: 360, maxWidth: 760 }}>
      <div style={{ maxHeight: 420, overflow: 'auto', paddingRight: 6 }}>
        {mightBeTruncated ? (
          <div style={{ color: '#b45309', fontSize: 12, marginBottom: 8 }}>
            This is a compact summary and may be truncated. Regenerate the document to save a full snapshot.
          </div>
        ) : null}
        {renderKVRows(groups.header)}
        {hasSelection ? renderKVRows(groups.selection) : null}
        {hasQueries ? (
          <div>
            <div style={sectionTitleStyle}>Queries</div>
            {renderKVRows(groups.queries)}
          </div>
        ) : null}
        {hasOptions ? (
          <div>
            <div style={sectionTitleStyle}>Options</div>
            {renderKVRows(groups.options)}
          </div>
        ) : null}
        {hasOther ? renderKVRows(groups.other) : null}
      </div>
    </div>
  );
};

const SelectedInputPopover = ({ inputSummary, inputDetailsKey, inputDetails, loading, onOpenChange }) => {
  const summary = String(inputSummary || '').trim();
  const detailsKey = String(inputDetailsKey || '').trim();
  if (!summary && !detailsKey) return null;
  return (
    <Popover
      title='Selected Input'
      trigger={['hover', 'focus']}
      placement='right'
      overlayStyle={{ maxWidth: 760 }}
      onOpenChange={onOpenChange}
      content={loading ? <div style={{ padding: 12, minWidth: 360 }}>Loading input…</div> : <SelectedInputPopoverContent inputSummary={summary} inputDetails={inputDetails} />}
    >
      <span tabIndex={0} aria-label='View selected input' style={{ display: 'inline-flex' }}>
        <InfoCircleOutlined style={{ color: '#1677ff' }} />
      </span>
    </Popover>
  );
};

export default SelectedInputPopover;
