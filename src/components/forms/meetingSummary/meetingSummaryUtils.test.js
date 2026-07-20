import { describe, expect, test } from 'vitest';
import {
  buildMeetingSummaryContentControls,
  createMeetingSummaryDocForm,
  deriveMeetingSummaryMode,
  findMeetingSummaryTemplate,
  isValidMeetingSummaryTemplateName,
} from './meetingSummaryUtils';

describe('meetingSummaryUtils', () => {
  test('creates the Meeting-Summary form with three expected controls', () => {
    const form = createMeetingSummaryDocForm();

    expect(form.documentTitle).toBe('Meeting-Summary-document');
    expect(form.contentControls).toEqual([
      expect.objectContaining({
        title: 'meeting-summary-content-control',
        skin: 'paragraph',
      }),
      expect.objectContaining({
        title: 'meeting-tasks-content-control',
        skin: 'table',
      }),
      expect.objectContaining({
        title: 'previous-open-tasks-content-control',
        skin: 'table',
        optional: true,
      }),
    ]);
  });

  test('finds only templates matching the selected orientation', () => {
    const templates = [
      { name: 'shared/Meeting-Summary/customer-landscape-template.docx', url: 'landscape-url' },
      { name: 'shared/Meeting-Summary/customer-portrait-template.dotx', url: 'portrait-url' },
      { name: 'shared/Meeting-Summary/customer-template.docx', url: 'generic-url' },
    ];

    expect(findMeetingSummaryTemplate(templates, 'portrait')).toEqual(templates[1]);
    expect(findMeetingSummaryTemplate(templates, 'landscape')).toEqual(templates[0]);
    expect(findMeetingSummaryTemplate([templates[2]], 'portrait')).toBeNull();
  });

  test('builds required paragraph and table query content controls', () => {
    const controls = buildMeetingSummaryContentControls({
      meetingSummaryQueryId: 'summary-query',
      meetingTasksQueryId: 'tasks-query',
      previousOpenTasksQueryId: 'previous-query',
    });

    expect(controls).toEqual([
      {
        title: 'meeting-summary-content-control',
        type: 'query',
        skin: 'paragraph',
        forceClean: true,
        data: { type: 'query', queryId: 'summary-query', skinType: 'paragraph', styledHeader: false },
      },
      {
        title: 'meeting-tasks-content-control',
        type: 'query',
        skin: 'table',
        forceClean: true,
        data: { type: 'query', queryId: 'tasks-query', skinType: 'table', styledHeader: true },
      },
      {
        title: 'previous-open-tasks-content-control',
        type: 'query',
        skin: 'table',
        forceClean: true,
        data: { type: 'query', queryId: 'previous-query', skinType: 'table', styledHeader: true },
      },
    ]);
  });

  test('derives orientation mode from a Meeting-Summary template filename', () => {
    expect(deriveMeetingSummaryMode('Meeting-Summary-Landscape.dotx')).toBe('landscape');
    expect(deriveMeetingSummaryMode('shared/Meeting-Summary/customer-PORTRAIT-v2.docx')).toBe('portrait');
    expect(deriveMeetingSummaryMode('Meeting-Summary-generic.docx')).toBeNull();
    expect(deriveMeetingSummaryMode('SVD-Landscape.docx')).toBeNull();
    expect(deriveMeetingSummaryMode('')).toBeNull();
    expect(deriveMeetingSummaryMode(null)).toBeNull();
  });

  test('validates a Meeting-Summary template filename requires the doc-type token and an orientation', () => {
    expect(isValidMeetingSummaryTemplateName('Meeting-Summary-Landscape.dotx')).toBe(true);
    expect(isValidMeetingSummaryTemplateName('Meeting-Summary-Portrait.docx')).toBe(true);
    expect(isValidMeetingSummaryTemplateName('Meeting-Summary-generic.docx')).toBe(false);
    expect(isValidMeetingSummaryTemplateName('landscape.docx')).toBe(false);
    expect(isValidMeetingSummaryTemplateName('Meeting-Summary-Landscape.pdf')).toBe(false);
    expect(isValidMeetingSummaryTemplateName('')).toBe(false);
  });

  test('adds an empty cleanup control when optional query is not selected', () => {
    const controls = buildMeetingSummaryContentControls({
      meetingSummaryQueryId: 'summary-query',
      meetingTasksQueryId: 'tasks-query',
    });

    expect(controls.map((control) => control.title)).toEqual([
      'meeting-summary-content-control',
      'meeting-tasks-content-control',
      'previous-open-tasks-content-control',
    ]);
    expect(controls[2]).toEqual({
      title: 'previous-open-tasks-content-control',
      type: 'empty',
      skin: 'empty',
      forceClean: true,
      data: { type: 'empty' },
    });
  });
});
