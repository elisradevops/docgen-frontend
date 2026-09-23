// Shared helpers for building an Automated-SVD pipeline setup snippet
// directly from the SVD picker's already-populated content control data —
// the same object shape ChangeTableSelector's range selectors write via
// addToDocumentRequestObject (see PipelineSelector.jsx / ReleaseSelector.jsx).
//
// This module intentionally reads only from that data object (plus a small
// "extras" object for the handful of pipeline-only fields with no
// interactive equivalent — see pipelineSetupExtras.js) and produces plain
// strings. It never calls docgen-api-gate and never triggers document
// generation — see docs/prod/SVDGenerationGuide.md, which this mirrors.

/**
 * Extracts the flat set of fields Invoke-SvdGeneration.ps1 / svd-job.yaml
 * need from a change-description-table content control's `data` object.
 * @param {object} data - contentControls[index].data, as written by
 *   PipelineSelector.jsx / ReleaseSelector.jsx.
 */
export function extractSvdFields(data) {
  const rangeType = data?.rangeType === 'release' ? 'release' : 'pipeline';

  const workItemFilterOptions = data?.workItemFilterOptions;
  const workItemFilterEnabled = Boolean(workItemFilterOptions?.isEnabled);
  // workItemTypes/workItemStates on the payload are lowercase-normalized for
  // backend matching; workItemTypeDetails/workItemStateDetails keep the
  // original display text/case, which is what a human-readable snippet
  // should show.
  const workItemFilterTypes = (workItemFilterOptions?.workItemTypeDetails || [])
    .map((t) => t?.text)
    .filter(Boolean)
    .join(', ');
  const workItemFilterStates = (workItemFilterOptions?.workItemStateDetails || [])
    .map((s) => s?.text)
    .filter(Boolean)
    .join(', ');

  const linkedWiOptions = data?.linkedWiOptions || {};
  const linkedWiEnabled = Boolean(linkedWiOptions?.isEnabled);
  const linkedWiTypes = linkedWiOptions?.linkedWiTypes || 'both';
  const linkedWiRelationship = linkedWiOptions?.linkedWiRelationship || 'both';

  const systemOverviewQueryUrl = data?.systemOverviewQuery?.sysOverviewQuery?.wiql?.href || '';
  const knownBugsQueryUrl = data?.systemOverviewQuery?.knownBugsQuery?.wiql?.href || '';

  return {
    rangeType,
    // Pipeline range
    pipelineId: rangeType === 'pipeline' ? data?.selectedPipeline?.key ?? '' : '',
    pipelineText: rangeType === 'pipeline' ? data?.selectedPipeline?.text ?? '' : '',
    fromBuildId: rangeType === 'pipeline' ? data?.from ?? '' : '',
    toBuildId: rangeType === 'pipeline' ? data?.to ?? '' : '',
    // Release range
    releaseDefinitionId: rangeType === 'release' ? data?.selectedRelease?.key ?? '' : '',
    releaseDefinitionText: rangeType === 'release' ? data?.selectedRelease?.text ?? '' : '',
    fromReleaseId: rangeType === 'release' ? data?.from ?? '' : '',
    toReleaseId: rangeType === 'release' ? data?.to ?? '' : '',
    compareMode: rangeType === 'release' ? data?.compareMode || 'consecutive' : 'consecutive',
    // Content options (already collected by the picker)
    includeCommittedBy: Boolean(data?.includeCommittedBy),
    includeUnlinkedCommits: Boolean(data?.includeUnlinkedCommits),
    includePullRequestWorkItems: Boolean(data?.includePullRequestWorkItems),
    replaceTaskWithParent: Boolean(data?.replaceTaskWithParent),
    // Document sections
    systemOverviewQueryUrl,
    knownBugsQueryUrl,
    attachmentWikiUrl: data?.attachmentWikiUrl || '',
    // Work items
    workItemFilterEnabled,
    workItemFilterTypes,
    workItemFilterStates,
    linkedWiEnabled,
    linkedWiTypes,
    linkedWiRelationship,
  };
}

/** Setup checklist text, sourced verbatim from
 * docs/prod/SVDGenerationGuide.md's "Setup (step by step)" section. */
export const CLASSIC_RELEASE_CHECKLIST = [
  'Pipeline tab → Artifacts → + Add → Azure Repos Git: repository "pipeline-templates", default branch "main", source alias "_pipeline-templates".',
  'Pipeline tab → + Add (after your last stage) → Empty job → name it "Generate SVD".',
  'Open the new stage → Agent job → set Agent pool to "windows" → Additional options → check "Allow scripts to access the OAuth token" (skipping this fails with "Token is required").',
  'Inside the Agent job, add a PowerShell task, set Type to "Inline", and paste the script below.',
];

export function yamlResourcesScaffold({ project, pipelineName }) {
  return [
    'resources:',
    '  repositories:',
    '    - repository: DevOpsTemplates',
    '      type: git',
    `      name: ${project || '<PROJECT>'}/pipeline-templates`,
    '      ref: main',
    '  pipelines:',
    `    - pipeline: ${pipelineName || 'myBuild'}`,
    `      project: ${project || '<PROJECT>'}`,
    `      source: ${pipelineName || '<BUILD_PIPELINE_NAME>'}`,
    '      branch: main',
  ].join('\n');
}
