// Builds the exact inline-PowerShell block documented in
// docs/prod/SVDGenerationGuide.md's "Release Range (Release SVD)" section —
// backtick line continuation, no comments between backtick lines, booleans
// as quoted strings. Classic Release always targets the release range (the
// script auto-detects that from the running release's environment), so this
// builder never emits -RangeType or pipeline-range parameters, matching
// every worked example in the guide.
import { CLASSIC_RELEASE_CHECKLIST, extractSvdFields } from './pipelineSetupCommon';

const TOKEN_EXPR = '$env:SYSTEM_ACCESSTOKEN';
const TRUE = "'true'";

/** Single-quoted literal, unless the value is a $(...) macro (needs double
 * quotes for interpolation) or an already-raw $env:/$(...) expression. */
function quote(value) {
  if (value.startsWith('$env:')) return value;
  if (value.includes('$(')) return `"${value}"`;
  return `'${value}'`;
}

export function getClassicReleaseErrors({ orgUrl }) {
  const errors = [];
  if (!orgUrl?.trim()) errors.push('Org URL is required.');
  return errors;
}

/**
 * @param {object} contentControlData - contentControls[index].data from the
 *   SVD picker (see pipelineSetupCommon.extractSvdFields).
 * @param {{orgUrl: string, apiUrl?: string, templateFile?: string}} context
 * @param {object} extras - see pipelineSetupExtras.DEFAULT_PIPELINE_SETUP_EXTRAS
 */
export function buildClassicReleaseSnippet(contentControlData, context, extras) {
  const fields = extractSvdFields(contentControlData);
  const errors = getClassicReleaseErrors(context);
  const params = [];

  params.push({ name: 'Token', raw: TOKEN_EXPR });
  params.push({ name: 'OrgUrl', raw: quote(context.orgUrl || '<TFS_COLLECTION_URL>') });
  if (context.apiUrl?.trim()) params.push({ name: 'ApiUrl', raw: quote(context.apiUrl.trim()) });
  if (context.templateFile?.trim()) {
    params.push({ name: 'TemplateFile', raw: quote(context.templateFile.trim()) });
  }

  // Release range — Classic Release auto-detects the definition itself.
  if (fields.fromReleaseId) params.push({ name: 'FromReleaseId', raw: quote(fields.fromReleaseId) });
  if (fields.toReleaseId) params.push({ name: 'ToReleaseId', raw: quote(fields.toReleaseId) });
  if (fields.compareMode !== 'consecutive') {
    params.push({ name: 'CompareMode', raw: quote(fields.compareMode) });
  }

  if (extras.includePullRequests) params.push({ name: 'IncludePullRequests', raw: TRUE });
  if (fields.includePullRequestWorkItems) params.push({ name: 'IncludePullRequestWorkItems', raw: TRUE });
  if (extras.includeChangeDescription) params.push({ name: 'IncludeChangeDescription', raw: TRUE });
  if (fields.includeCommittedBy) params.push({ name: 'IncludeCommittedBy', raw: TRUE });
  if (fields.includeUnlinkedCommits) params.push({ name: 'IncludeUnlinkedCommits', raw: TRUE });
  if (fields.replaceTaskWithParent) params.push({ name: 'ReplaceTaskWithParent', raw: TRUE });
  if (extras.excludedRepoNames?.trim()) {
    params.push({ name: 'ExcludedRepoNames', raw: quote(extras.excludedRepoNames.trim()) });
  }

  if (fields.systemOverviewQueryUrl) {
    params.push({ name: 'SystemOverviewQueryUrl', raw: quote(fields.systemOverviewQueryUrl) });
  }
  if (fields.knownBugsQueryUrl) {
    params.push({ name: 'KnownBugsQueryUrl', raw: quote(fields.knownBugsQueryUrl) });
  }
  if (fields.attachmentWikiUrl) {
    params.push({ name: 'AttachmentWikiUrl', raw: quote(fields.attachmentWikiUrl) });
  }

  if (fields.linkedWiEnabled) {
    params.push({ name: 'LinkedWiEnabled', raw: TRUE });
    if (fields.linkedWiTypes !== 'both') params.push({ name: 'LinkedWiTypes', raw: quote(fields.linkedWiTypes) });
    if (fields.linkedWiRelationship !== 'both') {
      params.push({ name: 'LinkedWiRelationship', raw: quote(fields.linkedWiRelationship) });
    }
  }
  if (fields.workItemFilterEnabled) {
    params.push({ name: 'WorkItemFilterEnabled', raw: TRUE });
    if (fields.workItemFilterTypes) {
      params.push({ name: 'WorkItemFilterTypes', raw: quote(fields.workItemFilterTypes) });
    }
    if (fields.workItemFilterStates) {
      params.push({ name: 'WorkItemFilterStates', raw: quote(fields.workItemFilterStates) });
    }
  }

  if (extras.uploadToJfrog) {
    params.push({ name: 'UploadToJfrog', raw: TRUE });
    if (extras.jfrogUrl?.trim()) params.push({ name: 'JfrogUrl', raw: quote(extras.jfrogUrl.trim()) });
    if (extras.jfrogRepo?.trim()) params.push({ name: 'JfrogRepo', raw: quote(extras.jfrogRepo.trim()) });
    if (extras.jfrogPath?.trim()) params.push({ name: 'JfrogPath', raw: quote(extras.jfrogPath.trim()) });
  }

  if (extras.sendEmail) {
    params.push({ name: 'SendEmail', raw: TRUE });
    if (extras.mailFrom?.trim()) params.push({ name: 'MailFrom', raw: quote(extras.mailFrom.trim()) });
    params.push({ name: 'MailTo', raw: quote(extras.mailTo?.trim() || '<RECIPIENT_EMAIL>') });
    if (extras.mailCC?.trim()) params.push({ name: 'MailCC', raw: quote(extras.mailCC.trim()) });
    if (extras.mailSubject?.trim()) params.push({ name: 'MailSubject', raw: quote(extras.mailSubject.trim()) });
    if (extras.smtpServer?.trim()) params.push({ name: 'SmtpServer', raw: quote(extras.smtpServer.trim()) });
    if (extras.smtpPort?.trim() && extras.smtpPort.trim() !== '25') {
      params.push({ name: 'SmtpPort', raw: quote(extras.smtpPort.trim()) });
    }
  }

  const maxNameLen = Math.max(...params.map((p) => p.name.length));
  const lines = params.map((p, i) => {
    const padded = p.name.padEnd(maxNameLen, ' ');
    const continuation = i === params.length - 1 ? '' : ' `';
    return `    -${padded} ${p.raw}${continuation}`;
  });

  const code =
    '& "$(System.DefaultWorkingDirectory)/_pipeline-templates/scripts/Invoke-SvdGeneration.ps1" `\n' +
    lines.join('\n');

  return { code, checklist: CLASSIC_RELEASE_CHECKLIST, errors };
}
