import React, { forwardRef, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Button as AntButton, ConfigProvider, theme as antdTheme } from 'antd';
import logger from '../../../utils/logger';
import { VISUALLY_HIDDEN } from './a11y';
import { antTableSelectors, countPrepended, newEventsLabel, pickHeaderWidths, sameWidths } from './logsExplorerState';

// A virtualized body for the logs table: only the rows near the viewport exist in the DOM, so a full
// table (up to LOG_ROW_CAP rows) costs the same to update as a short one. The antd Table keeps rendering
// its own header (sort arrows, facet filters); this replaces only the rows, laid out from the same columns.
const START_INDEX = 1000000; // Virtuoso counts down from here as rows are prepended while the reader is scrolled away
const OVERSCAN_PX = 400; // rows rendered beyond the viewport, so a fast scroll does not show blanks

const cellValue = (column, record) => {
  const key = Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex;
  return key === undefined ? undefined : record[key];
};

// The cells take the header's MEASURED column widths (see useHeaderWidths), so the two cannot drift. Until
// they are measured, extra width is shared in proportion to each column's width, which is close.
const columnStyle = (column, measured) =>
  measured ? { flex: `0 0 ${measured}px` } : { flex: `${column.width} 1 ${column.width}px` };

// Memoized per row: a poll that adds rows re-renders only the new ones.
const LogRow = React.memo(({ record, columns, widths, divider }) => (
  <div role='row' style={{ display: 'flex', alignItems: 'flex-start', borderBottom: `1px solid ${divider}` }}>
    {columns.map((column, index) => (
      <div
        key={column.key}
        role='cell'
        style={{ ...columnStyle(column, widths?.[index]), padding: '8px', minWidth: 0 /* lets a long message shrink instead of widening the row */, boxSizing: 'border-box', overflow: 'hidden', overflowWrap: 'anywhere' }}
      >
        {column.render ? column.render(cellValue(column, record), record) : cellValue(column, record)}
      </div>
    ))}
  </div>
));
LogRow.displayName = 'LogRow';

// Virtuoso renders its rows inside this element; the role makes them a proper group of the table.
const RowGroup = forwardRef(({ style, children, ...rest }, ref) => (
  <div ref={ref} role='rowgroup' style={style} {...rest}>
    {children}
  </div>
));
RowGroup.displayName = 'RowGroup';
const LIST_COMPONENTS = { List: RowGroup };

// The widths (px) the antd header gave its columns, kept current while the table is resized. Reads antd's
// own header element (its class prefix comes from the ConfigProvider); when it is not there the rows keep
// their proportional widths and one debug line says why.
const useHeaderWidths = (wrapperRef, columnCount) => {
  const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
  const [widths, setWidths] = useState(null);
  const warnedRef = useRef(false);
  useLayoutEffect(() => {
    const selectors = antTableSelectors(getPrefixCls('table'));
    const headerTable = wrapperRef.current?.closest(selectors.table)?.querySelector(selectors.headerTable);
    if (!headerTable) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        logger.debug(`Logs table: antd header not found (${selectors.headerTable}); rows use proportional widths.`);
      }
      return undefined;
    }
    const measure = () => {
      const next = pickHeaderWidths(
        [...headerTable.querySelectorAll('th')].map((cell) => cell.getBoundingClientRect().width),
        columnCount
      );
      if (next) setWidths((prev) => (sameWidths(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(headerTable);
    return () => observer.disconnect();
  }, [wrapperRef, columnCount, getPrefixCls]);
  return widths;
};

const VirtualLogBody = ({ data, columns, height }) => {
  const { token } = antdTheme.useToken();
  const wrapperRef = useRef(null);
  const widths = useHeaderWidths(wrapperRef, columns.length);
  const listRef = useRef(null);
  const atTopRef = useRef(true);
  const firstIdRef = useRef(undefined);
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const [pending, setPending] = useState(0);
  // Bumped when the rows are replaced (another filter, sort or window): the list is recreated, so it starts
  // at the top with a fresh index instead of keeping the previous query's scroll position.
  const [listKey, setListKey] = useState(0);

  // New rows arrive at the top. At the top the reader keeps seeing the newest; scrolled away, their position
  // is kept (the list index shifts by the number of rows added) and a pill counts what is waiting above.
  useLayoutEffect(() => {
    const added = countPrepended(firstIdRef.current, data);
    firstIdRef.current = data[0]?._id;
    if (added > 0 && !atTopRef.current) {
      setFirstItemIndex((index) => index - added);
      setPending((count) => count + added);
    } else if (added < 0) {
      atTopRef.current = true;
      setFirstItemIndex(START_INDEX);
      setPending(0);
      setListKey((key) => key + 1);
    }
  }, [data]);

  const onAtTopChange = useCallback((atTop) => {
    atTopRef.current = atTop;
    if (atTop) setPending(0);
  }, []);

  const jumpToNewest = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const itemContent = useCallback(
    (_index, record) => <LogRow record={record} columns={columns} widths={widths} divider={token.colorSplit} />,
    [columns, widths, token.colorSplit]
  );

  return (
    <div
      ref={wrapperRef}
      role='table'
      aria-label='Log events'
      aria-rowcount={data.length}
      aria-colcount={columns.length}
      style={{ position: 'relative' }}
    >
      {/* Screen readers hear one fixed sentence when events are waiting above, not a count that changes
          at every poll. The visible pill is a button, so it is reachable by keyboard. */}
      <span role='status' style={VISUALLY_HIDDEN}>
        {pending > 0 ? 'New events are waiting above.' : ''}
      </span>
      {pending > 0 ? (
        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
          <AntButton type='primary' size='small' shape='round' onClick={jumpToNewest} style={{ pointerEvents: 'auto' }}>
            {newEventsLabel(pending)} ↑
          </AntButton>
        </div>
      ) : null}
      <Virtuoso
        key={listKey}
        ref={listRef}
        style={{ height }}
        tabIndex={0}
        components={LIST_COMPONENTS}
        data={data}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={0}
        atTopStateChange={onAtTopChange}
        computeItemKey={(_index, record) => record._id}
        itemContent={itemContent}
        increaseViewportBy={OVERSCAN_PX}
      />
    </div>
  );
};

export default VirtualLogBody;
