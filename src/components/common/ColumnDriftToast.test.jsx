import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import ColumnDriftToast from './ColumnDriftToast';

describe('ColumnDriftToast', () => {
  test('shows the query title as a group heading, and tags each entry with its side', () => {
    const drift = {
      'req-test': {
        title: 'Req-Test',
        dropped: [{ label: 'Customer ID', side: 'Test Case', wasRenamed: false, wasHidden: true }],
        added: [],
      },
    };

    const markup = renderToStaticMarkup(<ColumnDriftToast drift={drift} />);

    expect(markup).toContain('Req-Test');
    expect(markup).toContain('Removed (1)');
    expect(markup).toContain('Customer ID (Test Case)');
    expect(markup).toContain('was hidden');
  });

  test('renders a separate group per query key', () => {
    const drift = {
      'req-test': { title: 'Req-Test', dropped: [], added: [{ label: 'Severity', side: 'Requirement' }] },
      'test-req': { title: 'Test-Req', dropped: [{ label: 'Priority', side: 'Test Case', wasRenamed: false, wasHidden: false }], added: [] },
    };

    const markup = renderToStaticMarkup(<ColumnDriftToast drift={drift} />);

    expect(markup).toContain('Req-Test');
    expect(markup).toContain('Severity (Requirement)');
    expect(markup).toContain('Test-Req');
    expect(markup).toContain('Priority (Test Case)');
  });

  test('shows the save-again hint when wasPruned is true, omits it otherwise', () => {
    const drift = { 'req-test': { title: 'Req-Test', dropped: [], added: [{ label: 'X', side: 'Requirement' }] } };

    const withHint = renderToStaticMarkup(<ColumnDriftToast drift={drift} wasPruned />);
    const withoutHint = renderToStaticMarkup(<ColumnDriftToast drift={drift} />);

    expect(withHint).toContain('Save this favorite again to keep this fix.');
    expect(withoutHint).not.toContain('Save this favorite again');
  });

  test('renders no query groups when drift is empty', () => {
    const markup = renderToStaticMarkup(<ColumnDriftToast drift={{}} />);
    expect(markup).not.toContain('Removed');
    expect(markup).not.toContain('Added');
  });
});
