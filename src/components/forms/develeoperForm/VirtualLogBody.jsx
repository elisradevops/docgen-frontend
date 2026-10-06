import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Button as AntButton } from 'antd';
import { countPrepended, newEventsLabel } from './logsExplorerState';

// A virtualized body for the logs table: only the rows near the viewport exist in the DOM, so a full
// table (up to LOG_ROW_CAP rows) costs the same to update as a short one. The antd Table keeps rendering
// its own header (sort arrows, facet filters); this replaces only the rows, laid out from the same columns.
const START_INDEX = 1000000;

const cellValue = (column, record) => {
  const key = Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex;
  return key === undefined ? undefined : record[key];
};

// The cells take the header's MEASURED column widths (see useHeaderWidths), so the two cannot drift. Until
// they are measured, extra width is shared in proportion to each column's width, which is close.
const columnStyle = (column, measured) =>
  measured ? { flex: `0 0 ${measured}px` } : { flex: `${column.width} 1 ${column.width}px` };

// Memoized per row: a poll that adds rows re-renders only the new ones.
const LogRow = React.memo(({ record, columns, widths }) => (
  <div role='row' style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid #f0f0f0' }}>
    {columns.map((column, index) => (
      <div
        key={column.key}
        role='cell'
        style={{ ...columnStyle(column, widths?.[index]), padding: '8px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden', overflowWrap: 'anywhere' }}
      >
        {column.render ? column.render(cellValue(column, record), record) : cellValue(column, record)}
      </div>
    ))}
  </div>
));
LogRow.displayName = 'LogRow';

// The widths (px) the antd header gave its columns, kept current while the table is resized.
const useHeaderWidths = (wrapperRef, columnCount) => {
  const [widths, setWidths] = useState(null);
  useLayoutEffect(() => {
    const table = wrapperRef.current?.closest('.ant-table');
    const headerTable = table?.querySelector('.ant-table-header table');
    if (!headerTable) return undefined;
    const measure = () => {
      const cells = [...headerTable.querySelectorAll('th')].slice(0, columnCount);
      if (cells.length !== columnCount) return;
      const next = cells.map((cell) => Math.round(cell.getBoundingClientRect().width * 10) / 10);
      setWidths((prev) => (prev && prev.every((w, i) => Math.abs(w - next[i]) < 0.5) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(headerTable);
    return () => observer.disconnect();
  }, [wrapperRef, columnCount]);
  return widths;
};

const VirtualLogBody = ({ data, columns, height }) => {
  const wrapperRef = useRef(null);
  const widths = useHeaderWidths(wrapperRef, columns.length);
  const listRef = useRef(null);
  const atTopRef = useRef(true);
  const firstIdRef = useRef(undefined);
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const [pending, setPending] = useState(0);

  // New rows arrive at the top. At the top the reader keeps seeing the newest; scrolled away, their position
  // is kept (the list index shifts by the number of rows added) and a pill counts what is waiting above.
  useLayoutEffect(() => {
    const added = countPrepended(firstIdRef.current, data.map((row) => row._id));
    firstIdRef.current = data[0]?._id;
    if (added > 0 && !atTopRef.current) {
      setFirstItemIndex((index) => index - added);
      setPending((count) => count + added);
    } else if (added < 0) {
      setPending(0);
    }
  }, [data]);

  const onAtTopChange = useCallback((atTop) => {
    atTopRef.current = atTop;
    if (atTop) setPending(0);
  }, []);

  const jumpToNewest = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const itemContent = useCallback((_index, record) => <LogRow record={record} columns={columns} widths={widths} />, [columns, widths]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {pending > 0 ? (
        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
          <AntButton type='primary' size='small' shape='round' onClick={jumpToNewest} style={{ pointerEvents: 'auto' }}>
            {newEventsLabel(pending)} ↑
          </AntButton>
        </div>
      ) : null}
      <Virtuoso
        ref={listRef}
        style={{ height }}
        data={data}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={0}
        atTopStateChange={onAtTopChange}
        computeItemKey={(_index, record) => record._id}
        itemContent={itemContent}
        increaseViewportBy={400}
      />
    </div>
  );
};

export default VirtualLogBody;
