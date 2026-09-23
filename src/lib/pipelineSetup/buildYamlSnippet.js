// Builds the `- template: release-notes/svd-job.yaml@DevOpsTemplates` block
// documented in docs/prod/SVDGenerationGuide.md, for both range types.
// Booleans are quoted strings ('true'/'false'), matching every YAML example
// in the guide (e.g. `sendEmail: 'true'`).
import { extractSvdFields, yamlResourcesScaffold } from './pipelineSetupCommon';

function yamlString(value) {
  // Single-quoted YAML scalar; escape embedded single quotes by doubling them.
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function getYamlErrors({ orgUrl }, fields) {
  const errors = [];
  if (!orgUrl?.trim()) errors.push('orgUrl is required.');
  if (fields.rangeType === 'release' && !fields.releaseDefinitionId) {
    errors.push(
      'releaseDefinitionId is required for a release-range YAML job — there is no running release ' +
        'to auto-detect it from (unlike Classic Release).'
    );
  }
  return errors;
}

/**
 * @param {object} contentControlData - contentControls[index].data from the
 *   SVD picker.
 * @param {{orgUrl: string, apiUrl?: string, templateFile?: string, project?: string, pipelineName?: string}} context
 * @param {object} extras - see pipelineSetupExtras.DEFAULT_PIPELINE_SETUP_EXTRAS
 */
export function buildYamlSnippet(contentControlData, context, extras) {
  const fields = extractSvdFields(contentControlData);
  const errors = getYamlErrors(context, fields);
  const params = [];

  params.push({ name: 'orgUrl', value: yamlString(context.orgUrl || '<TFS_COLLECTION_URL>') });
  if (context.apiUrl?.trim()) params.push({ name: 'apiUrl', value: yamlString(context.apiUrl.trim()) });
  if (context.templateFile?.trim()) {
    params.push({ name: 'templateFile', value: yamlString(context.templateFile.trim()) });
  }

  if (fields.rangeType === 'release') {
    params.push({ name: 'rangeType', value: yamlString('release') });
    params.push({
      name: 'releaseDefinitionId',
      value: yamlString(fields.releaseDefinitionId || '<RELEASE_DEFINITION_ID>'),
    });
    if (fields.releaseDefinitionText) {
      params.push({ name: 'releaseDefinitionName', value: yamlString(fields.releaseDefinitionText) });
    }
    if (fields.fromReleaseId) params.push({ name: 'fromReleaseId', value: yamlString(fields.fromReleaseId) });
    if (fields.toReleaseId) params.push({ name: 'toReleaseId', value: yamlString(fields.toReleaseId) });
    if (fields.compareMode !== 'consecutive') {
      params.push({ name: 'compareMode', value: yamlString(fields.compareMode) });
    }
  } else {
    // pipeline is the template's implicit default rangeType — never emitted explicitly.
    if (fields.fromBuildId) params.push({ name: 'fromBuildId', value: yamlString(fields.fromBuildId) });
    if (fields.toBuildId) params.push({ name: 'toBuildId', value: yamlString(fields.toBuildId) });
  }

  if (extras.includePullRequests) params.push({ name: 'includePullRequests', value: yamlString('true') });
  if (fields.includePullRequestWorkItems) {
    params.push({ name: 'includePullRequestWorkItems', value: yamlString('true') });
  }
  if (extras.includeChangeDescription) params.push({ name: 'includeChangeDescription', value: yamlString('true') });
  if (fields.includeCommittedBy) params.push({ name: 'includeCommittedBy', value: yamlString('true') });
  if (fields.includeUnlinkedCommits) params.push({ name: 'includeUnlinkedCommits', value: yamlString('true') });
  if (fields.replaceTaskWithParent) params.push({ name: 'replaceTaskWithParent', value: yamlString('true') });

  if (fields.systemOverviewQueryUrl) {
    params.push({ name: 'systemOverviewQueryUrl', value: yamlString(fields.systemOverviewQueryUrl) });
  }
  if (fields.knownBugsQueryUrl) {
    params.push({ name: 'knownBugsQueryUrl', value: yamlString(fields.knownBugsQueryUrl) });
  }
  if (fields.attachmentWikiUrl) {
    params.push({ name: 'attachmentWikiUrl', value: yamlString(fields.attachmentWikiUrl) });
  }

  if (fields.linkedWiEnabled) {
    params.push({ name: 'linkedWiEnabled', value: yamlString('true') });
    if (fields.linkedWiTypes !== 'both') params.push({ name: 'linkedWiTypes', value: yamlString(fields.linkedWiTypes) });
    if (fields.linkedWiRelationship !== 'both') {
      params.push({ name: 'linkedWiRelationship', value: yamlString(fields.linkedWiRelationship) });
    }
  }
  if (fields.workItemFilterEnabled) {
    params.push({ name: 'workItemFilterEnabled', value: yamlString('true') });
    if (fields.workItemFilterTypes) {
      params.push({ name: 'workItemFilterTypes', value: yamlString(fields.workItemFilterTypes) });
    }
    if (fields.workItemFilterStates) {
      params.push({ name: 'workItemFilterStates', value: yamlString(fields.workItemFilterStates) });
    }
  }

  if (!extras.publishJfrog) params.push({ name: 'publishJfrog', value: yamlString('false') });
  if (!extras.jfrogBuildInfo) params.push({ name: 'jfrogBuildInfo', value: yamlString('false') });

  if (extras.sendEmail) {
    params.push({ name: 'sendEmail', value: yamlString('true') });
    if (extras.mailFrom?.trim()) params.push({ name: 'mailFrom', value: yamlString(extras.mailFrom.trim()) });
    params.push({ name: 'mailTo', value: yamlString(extras.mailTo?.trim() || '<RECIPIENT_EMAIL>') });
    if (extras.mailCC?.trim()) params.push({ name: 'mailCC', value: yamlString(extras.mailCC.trim()) });
    if (extras.mailSubject?.trim()) params.push({ name: 'mailSubject', value: yamlString(extras.mailSubject.trim()) });
    if (extras.smtpServer?.trim()) params.push({ name: 'smtpServer', value: yamlString(extras.smtpServer.trim()) });
    if (extras.smtpPort?.trim() && extras.smtpPort.trim() !== '25') {
      params.push({ name: 'smtpPort', value: extras.smtpPort.trim() }); // numeric in this template, unquoted
    }
  }

  const paramLines = params.map((p) => `    ${p.name}: ${p.value}`);
  const code = '- template: release-notes/svd-job.yaml@DevOpsTemplates\n  parameters:\n' + paramLines.join('\n');

  const checklist =
    fields.rangeType === 'pipeline'
      ? [
          'Add a `resources:` block with a `repositories:` entry for DevOpsTemplates (git, ' +
            '"<PROJECT>/pipeline-templates", ref main) and a `pipelines:` entry for the build ' +
            'pipeline you want to track — see the snippet below.',
          'Add the template call as a job alongside your existing build job.',
        ]
      : [
          'Paste the template call as a job in your YAML pipeline — no `resources:` block is needed ' +
            'for a release-range YAML job (unlike the pipeline-range case).',
        ];

  const resourcesScaffold =
    fields.rangeType === 'pipeline'
      ? yamlResourcesScaffold({ project: context.project, pipelineName: context.pipelineName || fields.pipelineText })
      : null;

  return { code, checklist, errors, resourcesScaffold };
}
