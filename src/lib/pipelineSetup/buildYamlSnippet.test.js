import { describe, expect, it } from 'vitest';
import { DEFAULT_PIPELINE_SETUP_EXTRAS } from './pipelineSetupExtras';
import { buildYamlSnippet, getYamlErrors } from './buildYamlSnippet';
import { extractSvdFields } from './pipelineSetupCommon';

function extras(overrides) {
  return { ...DEFAULT_PIPELINE_SETUP_EXTRAS, ...overrides };
}

const basePipelineData = {
  rangeType: 'pipeline',
  selectedPipeline: { key: 7, text: '7 - My-Build-Pipeline' },
  from: '',
  to: '',
  linkedWiOptions: { isEnabled: false, linkedWiTypes: 'both', linkedWiRelationship: 'both' },
  workItemFilterOptions: { isEnabled: false, workItemTypes: [], workItemStates: [] },
  systemOverviewQuery: { sysOverviewQuery: null, knownBugsQuery: null },
  attachmentWikiUrl: '',
  includeCommittedBy: false,
  includeUnlinkedCommits: false,
  includePullRequestWorkItems: false,
  replaceTaskWithParent: false,
};

const baseReleaseData = {
  ...basePipelineData,
  rangeType: 'release',
  selectedRelease: { key: 42, text: '42 - My-Release' },
  selectedPipeline: undefined,
  from: '5',
  to: '10',
  compareMode: 'consecutive',
};

describe('buildYamlSnippet', () => {
  it("matches the guide's pipeline-range auto-discover example shape", () => {
    const { code, errors } = buildYamlSnippet(
      basePipelineData,
      { orgUrl: 'http://<TFS_SERVER_HOST>/tfs/<COLLECTION_NAME>' },
      extras({ sendEmail: true, mailTo: '<RECIPIENT_EMAIL>' })
    );
    expect(errors).toEqual([]);
    expect(code).toContain('- template: release-notes/svd-job.yaml@DevOpsTemplates');
    expect(code).toContain('  parameters:');
    expect(code).toContain("orgUrl: 'http://<TFS_SERVER_HOST>/tfs/<COLLECTION_NAME>'");
    expect(code).toContain("sendEmail: 'true'");
    expect(code).toContain("mailTo: '<RECIPIENT_EMAIL>'");
    // pipeline is the implicit default rangeType — never emitted explicitly.
    expect(code).not.toContain('rangeType:');
  });

  it("matches the guide's release-range YAML example, requiring releaseDefinitionId", () => {
    const fields = extractSvdFields({ ...baseReleaseData, selectedRelease: { key: '', text: '' } });
    const errors = getYamlErrors({ orgUrl: 'http://x' }, fields);
    expect(errors.some((e) => e.includes('releaseDefinitionId'))).toBe(true);

    const { code } = buildYamlSnippet(baseReleaseData, { orgUrl: 'http://x' }, extras({}));
    expect(code).toContain("rangeType: 'release'");
    expect(code).toContain("releaseDefinitionId: '42'");
    expect(code).toContain("releaseDefinitionName: '42 - My-Release'");
    expect(code).toContain("fromReleaseId: '5'");
    expect(code).toContain("toReleaseId: '10'");
  });

  it('omits pipeline-range fields entirely when rangeType is release', () => {
    const { code } = buildYamlSnippet(baseReleaseData, { orgUrl: 'http://x' }, extras({}));
    expect(code).not.toContain('fromBuildId');
    expect(code).not.toContain('toBuildId');
  });

  it('omits publishJfrog/jfrogBuildInfo when left at their (true) defaults', () => {
    const { code } = buildYamlSnippet(basePipelineData, { orgUrl: 'http://x' }, extras({}));
    expect(code).not.toContain('publishJfrog');
    expect(code).not.toContain('jfrogBuildInfo');
  });

  it("emits publishJfrog: 'false' when explicitly turned off", () => {
    const { code } = buildYamlSnippet(basePipelineData, { orgUrl: 'http://x' }, extras({ publishJfrog: false }));
    expect(code).toContain("publishJfrog: 'false'");
  });

  it('produces the resources: scaffold only for pipeline-range YAML', () => {
    const { resourcesScaffold } = buildYamlSnippet(
      basePipelineData,
      { orgUrl: 'http://x', project: 'MyProject', pipelineName: 'My-Build-Pipeline' },
      extras({})
    );
    expect(resourcesScaffold).toContain('resources:');
    expect(resourcesScaffold).toContain('name: MyProject/pipeline-templates');
    expect(resourcesScaffold).toContain('source: My-Build-Pipeline');

    const { resourcesScaffold: releaseScaffold } = buildYamlSnippet(
      baseReleaseData,
      { orgUrl: 'http://x' },
      extras({})
    );
    expect(releaseScaffold).toBeNull();
  });
});
