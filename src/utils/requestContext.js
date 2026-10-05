// What the UI is working on right now (project, document type, session), as headers for the API.
// Kept free of any store import so both the Azure picker client and docManagerApi can use it
// without a circular dependency: DataStore registers a provider once, callers just read headers.
//
// The values only label log records (so a picker error can be filtered by project / document type
// and tied to the session that led to a generation). They carry no authority: api-gate validates
// and bounds every one of them.
let provider = null;

export const setRequestContextProvider = (fn) => {
  provider = typeof fn === 'function' ? fn : null;
};

const readContext = () => {
  try {
    return (provider && provider()) || {};
  } catch {
    // A broken provider must never break an API call.
    return {};
  }
};

// Header values must be ASCII, and project names are not guaranteed to be — percent-encode them.
// api-gate decodes. Bounded here as well; api-gate bounds again.
const encode = (value, max) => {
  const text = String(value ?? '').trim().slice(0, max);
  return text ? encodeURIComponent(text) : '';
};

/**
 * Headers for the data-picker calls (queries, test plans, projects, ...). The session id is sent as
 * the run id, so these requests are logged under the session instead of a throwaway request id.
 */
export const getPickerContextHeaders = () => {
  const { project, docType, sessionId } = readContext();
  const headers = {};
  const encodedProject = encode(project, 128);
  const encodedDocType = encode(docType, 40);
  if (encodedProject) headers['x-docgen-project'] = encodedProject;
  if (encodedDocType) headers['x-docgen-doc-type'] = encodedDocType;
  if (typeof sessionId === 'string' && /^ses-[A-Za-z0-9_-]{1,60}$/.test(sessionId)) {
    headers['x-docgen-run-id'] = sessionId;
  }
  return headers;
};

/** Header that tells api-gate which session a document generation was started from. */
export const getSessionHeader = () => {
  const { sessionId } = readContext();
  return typeof sessionId === 'string' && /^ses-[A-Za-z0-9_-]{1,60}$/.test(sessionId)
    ? { 'x-docgen-session-id': sessionId }
    : {};
};
