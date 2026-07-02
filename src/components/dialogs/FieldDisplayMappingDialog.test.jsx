import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import FieldDisplayMappingDialog from './FieldDisplayMappingDialog';

describe('FieldDisplayMappingDialog trigger badge', () => {
  test('shows restored column changes before the dialog is opened', () => {
    const markup = renderToStaticMarkup(
      <FieldDisplayMappingDialog
        fieldDisplayMapping={{
          'req-test': {
            Requirement: {
              'Custom.RequirementField': 'Requirement label',
            },
          },
        }}
        onMappingChange={vi.fn()}
        fieldVisibility={{
          'req-test': {
            'Test Case': {
              'Custom.TestCaseField': false,
            },
          },
        }}
        onVisibilityChange={vi.fn()}
        traceAnalysisMode='query'
        reqTestQuery={{ id: 'req-test-query', title: 'Req to TC' }}
      />
    );

    expect(markup).toContain('Column Settings');
    expect(markup).toContain('>2<');
  });
});
