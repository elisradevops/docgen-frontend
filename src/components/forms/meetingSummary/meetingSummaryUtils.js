export const MEETING_SUMMARY_DOC_TYPE = 'Meeting-Summary';

export const MEETING_SUMMARY_CONTROLS = {
  summary: 'meeting-summary-content-control',
  tasks: 'meeting-tasks-content-control',
  previousTasks: 'previous-open-tasks-content-control',
};

const normalizeMode = (mode) => String(mode || 'portrait').trim().toLowerCase();

const queryControl = (title, queryId, skinType) => ({
  title,
  type: 'query',
  skin: skinType,
  forceClean: true,
  data: {
    type: 'query',
    queryId,
    skinType,
    // Opts into the content-control's existing header-shading feature for table skins (docgen-content-control
    // hardcodes it off by default for generic query controls; other doc types' plain tables don't set this).
    styledHeader: skinType === 'table',
  },
});

const emptyControl = (title) => ({
  title,
  type: 'empty',
  skin: 'empty',
  forceClean: true,
  data: {
    type: 'empty',
  },
});

export const isMeetingSummaryDocType = (docType) =>
  String(docType || '').trim().toLowerCase() === MEETING_SUMMARY_DOC_TYPE.toLowerCase();

export const createMeetingSummaryDocForm = () => ({
  documentTitle: 'Meeting-Summary-document',
  templateFiles: ['Meeting-Summary'],
  contentControls: [
    {
      type: 'query',
      title: MEETING_SUMMARY_CONTROLS.summary,
      skin: 'paragraph',
      data: { type: 'query' },
    },
    {
      type: 'query',
      title: MEETING_SUMMARY_CONTROLS.tasks,
      skin: 'table',
      data: { type: 'query' },
    },
    {
      type: 'query',
      title: MEETING_SUMMARY_CONTROLS.previousTasks,
      skin: 'table',
      optional: true,
      data: { type: 'query' },
    },
  ],
  tabIndex: 6,
});

const templateFileName = (template) => String(template?.name || template?.text || '').toLowerCase();

// Shared predicate: true when a filename is a usable Meeting-Summary template for the given mode
// (or for either orientation, when mode is omitted).
const matchesMeetingSummaryTemplate = (name, mode) => {
  if (!/\.(docx|dotx)$/i.test(name)) return false;
  if (!name.includes('meeting-summary')) return false;
  if (mode) return name.includes(normalizeMode(mode));
  return name.includes('portrait') || name.includes('landscape');
};

export const findMeetingSummaryTemplate = (templates, mode) => {
  const selectedMode = normalizeMode(mode);
  return (
    (Array.isArray(templates) ? templates : []).find((template) =>
      matchesMeetingSummaryTemplate(templateFileName(template), selectedMode),
    ) || null
  );
};

// Derives portrait/landscape from a template's filename so the selected template (not a toggle)
// is the source of truth for orientation. Returns null when the name doesn't identify a Meeting-Summary
// template or doesn't state an orientation.
export const deriveMeetingSummaryMode = (templateName) => {
  const name = String(templateName || '').toLowerCase();
  if (!name.includes('meeting-summary')) return null;
  if (name.includes('portrait')) return 'portrait';
  if (name.includes('landscape')) return 'landscape';
  return null;
};

// True when a filename is acceptable to use as a Meeting-Summary template of either orientation
// (Word file, "meeting-summary" token, and states portrait or landscape).
export const isValidMeetingSummaryTemplateName = (templateName) =>
  matchesMeetingSummaryTemplate(String(templateName || '').toLowerCase());

export const buildMeetingSummaryContentControls = ({
  meetingSummaryQueryId,
  meetingTasksQueryId,
  previousOpenTasksQueryId,
}) => {
  const controls = [
    queryControl(MEETING_SUMMARY_CONTROLS.summary, meetingSummaryQueryId, 'paragraph'),
    queryControl(MEETING_SUMMARY_CONTROLS.tasks, meetingTasksQueryId, 'table'),
  ];

  controls.push(
    previousOpenTasksQueryId
      ? queryControl(MEETING_SUMMARY_CONTROLS.previousTasks, previousOpenTasksQueryId, 'table')
      : emptyControl(MEETING_SUMMARY_CONTROLS.previousTasks),
  );

  return controls;
};
