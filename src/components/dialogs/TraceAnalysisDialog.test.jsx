import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import TraceAnalysisDialog, { SortByToggle } from './TraceAnalysisDialog';

const baseStore = {
  fetchLoadingState: () => ({ sharedQueriesLoadingState: false }),
  fetchQueryDefinition: vi.fn(),
};

const sharedQueries = { acquiredTrees: null };

describe('TraceAnalysisDialog trigger (closed-dialog smoke test)', () => {
  // The dialog only mounts its body (including SortByToggle) once opened, and this repo has
  // no DOM/interaction test setup (no jsdom, no testing-library) to click it open. These two
  // tests only prove the closed trigger constructs without throwing for both old and new
  // prevTraceAnalysisRequest shapes. See the `SortByToggle` describe block below for actual
  // coverage of the new Sort By control's rendering behavior.
  test('constructs without throwing when sortBy is present on prevTraceAnalysisRequest', () => {
    const markup = renderToStaticMarkup(
      <TraceAnalysisDialog
        store={baseStore}
        sharedQueries={sharedQueries}
        prevTraceAnalysisRequest={{
          traceAnalysisMode: 'query',
          reqTestQuery: null,
          testReqQuery: null,
          includeCommonColumnsMode: 'both',
          fieldDisplayMapping: {},
          fieldVisibility: {},
          fieldOrder: {},
          sortBy: { 'req-test': 'suite', 'test-req': 'query' },
        }}
        onTraceAnalysisChange={vi.fn()}
      />
    );

    expect(markup).toContain('Trace Analysis');
  });

  test('constructs without throwing when sortBy is missing (pre-existing favorite, backward compat)', () => {
    const markup = renderToStaticMarkup(
      <TraceAnalysisDialog
        store={baseStore}
        sharedQueries={sharedQueries}
        prevTraceAnalysisRequest={{
          traceAnalysisMode: 'none',
          reqTestQuery: null,
          testReqQuery: null,
          includeCommonColumnsMode: 'both',
          fieldDisplayMapping: {},
          fieldVisibility: {},
          fieldOrder: {},
          // no sortBy key — simulates a favorite saved before this feature existed
        }}
        onTraceAnalysisChange={vi.fn()}
      />
    );

    expect(markup).toContain('Trace Analysis');
  });
});

describe('SortByToggle', () => {
  test('renders the Query/Suite switch labels', () => {
    const markup = renderToStaticMarkup(
      <SortByToggle
        direction='req-test'
        value='query'
        onChange={vi.fn()}
        disabled={false}
      />
    );

    expect(markup).toContain('Sort By');
    expect(markup).toContain('Query');
    expect(markup).toContain('Suite');
  });

  test('reflects the checked state for "suite" vs "query"', () => {
    const suiteMarkup = renderToStaticMarkup(
      <SortByToggle
        direction='test-req'
        value='suite'
        onChange={vi.fn()}
        disabled={false}
      />
    );
    const queryMarkup = renderToStaticMarkup(
      <SortByToggle
        direction='test-req'
        value='query'
        onChange={vi.fn()}
        disabled={false}
      />
    );

    expect(suiteMarkup).toContain('ant-switch-checked');
    expect(queryMarkup).not.toContain('ant-switch-checked');
  });

  test('renders disabled with the disabled-reason tooltip target when no query is selected', () => {
    const markup = renderToStaticMarkup(
      <SortByToggle
        direction='req-test'
        value='query'
        onChange={vi.fn()}
        disabled={true}
      />
    );

    expect(markup).toContain('ant-switch-disabled');
  });

  test('exposes a distinct aria-label per direction', () => {
    const reqTestMarkup = renderToStaticMarkup(
      <SortByToggle
        direction='req-test'
        value='query'
        onChange={vi.fn()}
        disabled={false}
      />
    );
    const testReqMarkup = renderToStaticMarkup(
      <SortByToggle
        direction='test-req'
        value='query'
        onChange={vi.fn()}
        disabled={false}
      />
    );

    expect(reqTestMarkup).toContain('Sort by, req-test');
    expect(testReqMarkup).toContain('Sort by, test-req');
  });
});
