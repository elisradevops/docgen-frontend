// Pure derivation for the Monitoring tab, kept out of the component so it stays unit-testable
// under vitest without jsdom/@testing-library (see ServiceConnectionsDashboard.test.jsx's own
// precedent — it tests only the extracted serviceVersions.js, never the component).
import { getSeverityLevel, collectMonitoredTargets } from './healthSummary';

/**
 * "All services are healthy." or "<service> is degraded, <service> is down." — one sentence
 * answering "is anything wrong", derived from the same severity model ServiceConnectionsDashboard
 * uses, without re-rendering its health strip.
 */
export const buildHealthSentence = (services = []) => {
  const targets = collectMonitoredTargets(services);
  const notHealthy = targets.filter((target) => getSeverityLevel(target?.status, target?.connectionStatus) !== 0);
  if (notHealthy.length === 0) {
    return 'All services are healthy.';
  }
  const clauses = notHealthy.map((target) => {
    const severity = getSeverityLevel(target?.status, target?.connectionStatus);
    const name = target?.displayName || target?.key || 'A service';
    return `${name} is ${severity === 2 ? 'down' : 'degraded'}`;
  });
  return `${clauses.join(', ')}.`;
};

/**
 * "248 runs in the last 24 hours, including 1 regression." — the second half of the header
 * sentence, from GET /diagnostics/overview.
 */
export const buildRunsSentence = (overview) => {
  const runs = overview?.runs;
  const issues = overview?.issues;
  if (!runs) return '';
  const windowHours = runs.windowHours ?? 24;
  const runsClause = `${runs.total ?? 0} run${runs.total === 1 ? '' : 's'} in the last ${windowHours} hours`;
  const regressed = issues?.regressed ?? 0;
  if (regressed > 0) {
    return `${runsClause}, including ${regressed} regression${regressed === 1 ? '' : 's'}.`;
  }
  return `${runsClause}.`;
};

/**
 * Replaces the internal normalization placeholder <n> (used to group issues by pattern rather
 * than exact value) with an ellipsis so it reads naturally in the UI. The placeholder is
 * intentional on the backend — it collapses "status code 503", "status code 401", etc. into one
 * issue — but leaking the raw token to users is confusing.
 */
export const formatSignature = (sig) => {
  if (!sig) return '';
  return sig.replace(/<n>/g, '…');
};

/**
 * Returns the first available project name from the issue's projects array, or undefined.
 * Issues accumulate projects via $addToSet as new occurrences arrive — the array may be empty
 * for infrastructure-level errors that fire outside of any project context.
 */
export const issueProject = (issue) =>
  Array.isArray(issue?.projects) && issue.projects.length > 0 ? issue.projects[0] : undefined;

/**
 * Returns the first available document type from the issue's docTypes array, or undefined.
 */
export const issueDocType = (issue) =>
  Array.isArray(issue?.docTypes) && issue.docTypes.length > 0 ? issue.docTypes[0] : undefined;

/**
 * True when the issue has enough run+project context for a meaningful baseline comparison.
 * "Compare to baseline" calls findBaselineRun(project, docType) — it always 404s for
 * infrastructure errors that have no project/docType, so we hide the button rather than let
 * users click it and see a confusing failure.
 */
export const issueHasBaselineContext = (issue) =>
  !!(issue?.occurrenceRunIds?.length && (issueProject(issue) || issueDocType(issue)));

/**
 * Metadata tokens for an issue card: service is always present; project and docType are shown
 * when available. Returned as an array so the component can join them with a separator of its
 * choice without re-implementing the fallback logic.
 */
export const issueMetaTokens = (issue) => {
  const tokens = [issue?.service || 'unknown service'];
  const project = issueProject(issue);
  const docType = issueDocType(issue);
  if (project) tokens.push(project);
  if (docType) tokens.push(docType);
  return tokens;
};

/**
 * @deprecated Use issueMetaTokens to build the metadata line instead.
 * Kept to avoid a breaking change in callers; will be removed in a follow-up cleanup.
 */
export const buildIssueContextSentence = (issue) => {
  const tokens = issueMetaTokens(issue);
  return `In ${tokens.join(', ')}.`;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "12 minutes ago" / "3.2 hours ago" / "6 days ago" — matches the prototype's own fmtAgo, kept
 * here rather than reimplemented per call site.
 */
export const formatRelativeTime = (date, now = new Date()) => {
  if (!date) return '';
  const ms = now.getTime() - new Date(date).getTime();
  if (ms < MINUTE_MS) return 'just now';
  if (ms < HOUR_MS) return `${Math.round(ms / MINUTE_MS)} minutes ago`;
  if (ms < DAY_MS) return `${(ms / HOUR_MS).toFixed(1)} hours ago`;
  return `${Math.round(ms / DAY_MS)} days ago`;
};
