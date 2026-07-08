import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import ColumnDriftToast from './ColumnDriftToast';

describe('ColumnDriftToast', () => {
  test('lists dropped columns with their rename/hidden tags', () => {
    const drift = {
      dropped: [
        { label: 'Customer ID', wasRenamed: true, wasHidden: false },
        { label: 'Severity', wasRenamed: false, wasHidden: true },
      ],
      added: [],
    };

    const markup = renderToStaticMarkup(<ColumnDriftToast drift={drift} />);

    expect(markup).toContain('Removed (2)');
    expect(markup).toContain('Customer ID (was renamed)');
    expect(markup).toContain('Severity (was hidden)');
    expect(markup).not.toContain('Save this favorite again');
  });

  test('lists added columns and shows the save-again hint when wasPruned is true', () => {
    const drift = { dropped: [], added: ['Node Name', 'Priority'] };

    const markup = renderToStaticMarkup(<ColumnDriftToast drift={drift} wasPruned />);

    expect(markup).toContain('Added (2)');
    expect(markup).toContain('Node Name');
    expect(markup).toContain('Priority');
    expect(markup).toContain('Save this favorite again to keep this fix.');
  });

  test('renders no list sections when both dropped and added are empty', () => {
    const markup = renderToStaticMarkup(<ColumnDriftToast drift={{ dropped: [], added: [] }} />);

    expect(markup).not.toContain('Removed');
    expect(markup).not.toContain('Added');
  });
});
