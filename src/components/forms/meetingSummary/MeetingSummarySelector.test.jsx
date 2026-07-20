import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import MeetingSummarySelector from './MeetingSummarySelector';

const createStore = (selectedTemplate = { url: 'portrait-url', text: 'Meeting-Summary-Portrait.dotx' }) => ({
  selectedTemplate,
  setSelectedTemplate: vi.fn(),
  addContentControlToDocument: vi.fn(),
  setValidationState: vi.fn(),
  clearValidationForIndex: vi.fn(),
  fetchLoadingState: () => ({ sharedQueriesLoadingState: false }),
  docType: 'Meeting-Summary',
  teamProject: 'Test Project',
  selectedFavorite: null,
  loadTabSessionState: vi.fn(() => null),
  saveTabSessionState: vi.fn(),
  clearTabSessionState: vi.fn(),
});

const sharedQueries = {
  acquiredTrees: {
    meetingSummaryTree: {
      title: 'Shared Queries',
      value: 'root',
      children: [
        {
          id: 'query-1',
          value: 'query-1',
          title: 'Meeting Summary Query',
          isValidQuery: true,
        },
      ],
    },
  },
};

describe('MeetingSummarySelector', () => {
  test('renders when sharedQueries uses the store acquiredTrees shape', () => {
    const markup = renderToStaticMarkup(
      <MeetingSummarySelector
        store={createStore()}
        sharedQueries={sharedQueries}
        onModeChange={vi.fn()}
      />
    );

    expect(markup).toContain('Meeting Summary');
    expect(markup).toContain('Tasks From The Meeting');
    expect(markup).toContain('Open Tasks From Previous Meetings');
  });

  test('derives and displays orientation from the selected template rather than a toggle', () => {
    const markup = renderToStaticMarkup(
      <MeetingSummarySelector
        store={createStore({ url: 'landscape-url', text: 'Meeting-Summary-Landscape.dotx' })}
        sharedQueries={sharedQueries}
        onModeChange={vi.fn()}
      />
    );

    expect(markup).toContain('Orientation: Landscape');
    expect(markup).not.toContain('MuiToggleButtonGroup');
  });

  test('warns when no valid Meeting-Summary template is selected', () => {
    const markup = renderToStaticMarkup(
      <MeetingSummarySelector
        store={createStore({ url: 'generic-url', text: 'Meeting-Summary-generic.docx' })}
        sharedQueries={sharedQueries}
        onModeChange={vi.fn()}
      />
    );

    expect(markup).toContain('No valid Meeting-Summary template selected');
  });

  test('previous-open-tasks card starts disabled (opt-in), showing the enable hint not an active picker', () => {
    const markup = renderToStaticMarkup(
      <MeetingSummarySelector
        store={createStore()}
        sharedQueries={sharedQueries}
        onModeChange={vi.fn()}
      />
    );

    expect(markup).toContain('Enable to select open tasks carried over from a previous meeting.');
    // Only the two required cards (Meeting Summary, Tasks) should render a "Selected query" recap —
    // the optional card is off by default and must not render its SettingsDisplay/QueryTree.
    const selectedQueryRecapCount = (markup.match(/No query selected yet\./g) || []).length;
    expect(selectedQueryRecapCount).toBe(2);
  });

  test('renders without crashing when a favorite or prior session state is present (persistence wiring smoke test)', () => {
    const store = createStore();
    store.selectedFavorite = {
      id: 'fav-1',
      __loadNonce: 'n1',
      dataToSave: { type: 'query', queryId: 'query-1', skinType: 'paragraph' },
    };
    store.loadTabSessionState = vi.fn(() => ({ type: 'query', queryId: 'query-1', skinType: 'table' }));

    // renderToStaticMarkup never runs effects, so this only asserts the hook wiring itself
    // (useTabStatePersistence x3 + the enrichment effect) doesn't throw during render.
    const markup = renderToStaticMarkup(
      <MeetingSummarySelector
        store={store}
        sharedQueries={sharedQueries}
        onModeChange={vi.fn()}
      />
    );

    expect(markup).toContain('Meeting Summary');
  });
});
