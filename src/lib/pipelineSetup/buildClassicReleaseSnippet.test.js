import { describe, expect, it } from 'vitest';
import { DEFAULT_PIPELINE_SETUP_EXTRAS, getPipelineSetupExtrasErrors } from './pipelineSetupExtras';
import { buildClassicReleaseSnippet, getClassicReleaseErrors } from './buildClassicReleaseSnippet';

function extras(overrides) {
  return { ...DEFAULT_PIPELINE_SETUP_EXTRAS, ...overrides };
}

const baseReleaseData = {
  rangeType: 'release',
  selectedRelease: { key: 42, text: '42 - My-Release' },
  from: '5',
  to: '$(Release.ReleaseId)',
  compareMode: 'consecutive',
  linkedWiOptions: { isEnabled: false, linkedWiTypes: 'both', linkedWiRelationship: 'both' },
  workItemFilterOptions: { isEnabled: false, workItemTypes: [], workItemStates: [] },
  systemOverviewQuery: { sysOverviewQuery: null, knownBugsQuery: null },
  attachmentWikiUrl: '',
  includeCommittedBy: false,
  includeUnlinkedCommits: false,
  includePullRequestWorkItems: false,
  replaceTaskWithParent: false,
};

describe('buildClassicReleaseSnippet', () => {
  it('matches the guide\'s "Example - Auto-discover releases with email" shape', () => {
    const { code, errors } = buildClassicReleaseSnippet(
      baseReleaseData,
      { orgUrl: 'http://<TFS_SERVER_HOST>/tfs/<COLLECTION_NAME>' },
      extras({ uploadToJfrog: true, sendEmail: true, mailTo: '<RECIPIENT_EMAIL>' })
    );
    // The guide's own example relies on the script's unconfigured JFrog
    // placeholder defaults; no JfrogUrl/JfrogRepo means nothing extra is
    // emitted for those — just the flag itself.
    expect(errors).toEqual([]);
    expect(code).toContain(
      '& "$(System.DefaultWorkingDirectory)/_pipeline-templates/scripts/Invoke-SvdGeneration.ps1" `'
    );
    expect(code).toContain('-Token');
    expect(code).toContain('$env:SYSTEM_ACCESSTOKEN');
    expect(code).toContain("-OrgUrl");
    expect(code).toContain("'http://<TFS_SERVER_HOST>/tfs/<COLLECTION_NAME>'");
    expect(code).toMatch(/-UploadToJfrog\s+'true'/);
    expect(code).toMatch(/-SendEmail\s+'true'/);
    expect(code).toMatch(/-MailTo\s+'<RECIPIENT_EMAIL>'/);
    // No -RangeType — Classic Release always auto-detects release range.
    expect(code).not.toContain('-RangeType');
    const lines = code.split('\n');
    expect(lines[lines.length - 1].endsWith('`')).toBe(false);
  });

  it('reads range IDs and compare mode directly from the picker data', () => {
    const { code } = buildClassicReleaseSnippet(
      { ...baseReleaseData, compareMode: 'allPairs' },
      { orgUrl: 'http://x' },
      extras({})
    );
    expect(code).toMatch(/-FromReleaseId\s+'5'/);
    expect(code).toMatch(/-ToReleaseId\s+"\$\(Release\.ReleaseId\)"/);
    expect(code).toMatch(/-CompareMode\s+'allPairs'/);
  });

  it('reads work item filter types/states with correct display case, not the lowercased matching form', () => {
    const data = {
      ...baseReleaseData,
      workItemFilterOptions: {
        isEnabled: true,
        workItemTypes: ['bug', 'user story'],
        workItemStates: ['active', 'resolved'],
        workItemTypeDetails: [{ text: 'Bug' }, { text: 'User Story' }],
        workItemStateDetails: [{ text: 'Active' }, { text: 'Resolved' }],
      },
    };
    const { code } = buildClassicReleaseSnippet(data, { orgUrl: 'http://x' }, extras({}));
    expect(code).toMatch(/-WorkItemFilterEnabled\s+'true'/);
    expect(code).toMatch(/-WorkItemFilterTypes\s+'Bug, User Story'/);
    expect(code).toMatch(/-WorkItemFilterStates\s+'Active, Resolved'/);
  });

  it('reads linked work item options and omits them when at defaults', () => {
    const enabled = {
      ...baseReleaseData,
      linkedWiOptions: { isEnabled: true, linkedWiTypes: 'reqOnly', linkedWiRelationship: 'coversOnly' },
    };
    const { code } = buildClassicReleaseSnippet(enabled, { orgUrl: 'http://x' }, extras({}));
    expect(code).toMatch(/-LinkedWiEnabled\s+'true'/);
    expect(code).toMatch(/-LinkedWiTypes\s+'reqOnly'/);
    expect(code).toMatch(/-LinkedWiRelationship\s+'coversOnly'/);

    const { code: code2 } = buildClassicReleaseSnippet(baseReleaseData, { orgUrl: 'http://x' }, extras({}));
    expect(code2).not.toContain('-LinkedWiEnabled');
  });

  it('reads the query hrefs and wiki attachment URL from the picker data', () => {
    const data = {
      ...baseReleaseData,
      systemOverviewQuery: {
        sysOverviewQuery: { wiql: { href: 'http://tfs/x/_apis/wit/wiql/abc' } },
        knownBugsQuery: { wiql: { href: 'http://tfs/x/_apis/wit/wiql/def' } },
      },
      attachmentWikiUrl: 'http://minio/wiki-attachments/install.docx',
    };
    const { code } = buildClassicReleaseSnippet(data, { orgUrl: 'http://x' }, extras({}));
    expect(code).toMatch(/-SystemOverviewQueryUrl\s+'http:\/\/tfs\/x\/_apis\/wit\/wiql\/abc'/);
    expect(code).toMatch(/-KnownBugsQueryUrl\s+'http:\/\/tfs\/x\/_apis\/wit\/wiql\/def'/);
    expect(code).toMatch(/-AttachmentWikiUrl\s+'http:\/\/minio\/wiki-attachments\/install\.docx'/);
  });

  it('quotes booleans as strings, never bare `true`', () => {
    const { code } = buildClassicReleaseSnippet(
      { ...baseReleaseData, replaceTaskWithParent: true },
      { orgUrl: 'http://x' },
      extras({ includePullRequests: true })
    );
    expect(code).toMatch(/-IncludePullRequests\s+'true'/);
    expect(code).toMatch(/-ReplaceTaskWithParent\s+'true'/);
    expect(code).not.toMatch(/-IncludePullRequests\s+true(?!')/);
  });

  it('flags a missing OrgUrl as an error', () => {
    expect(getClassicReleaseErrors({ orgUrl: '' })).toContain('Org URL is required.');
  });

  it('flags sendEmail on with empty mailTo as an error via the extras helper', () => {
    // Email validation lives in pipelineSetupExtras since it's extras-only state.
    const errors = getPipelineSetupExtrasErrors(extras({ sendEmail: true, mailTo: '' }));
    expect(errors.some((e) => e.includes('Mail To'))).toBe(true);
  });

  it('never requires JfrogUrl/JfrogRepo, on either surface — the script falls back to its own configured defaults', () => {
    expect(
      getPipelineSetupExtrasErrors(extras({ uploadToJfrog: true, jfrogUrl: '', jfrogRepo: '' }), 'classicRelease')
    ).toEqual([]);
    expect(getPipelineSetupExtrasErrors(extras({ uploadToJfrog: false }), 'classicRelease')).toEqual([]);
    expect(getPipelineSetupExtrasErrors(extras({ uploadToJfrog: true }), 'yaml')).toEqual([]);
  });

  it('accepts comma-separated Mail To/Mail CC addresses', () => {
    const errors = getPipelineSetupExtrasErrors(
      extras({ sendEmail: true, mailTo: 'a@x.com, b@x.com', mailCC: 'c@x.com,d@x.com' })
    );
    expect(errors).toEqual([]);
  });

  it('flags an invalid address in a comma-separated Mail To/Mail CC list', () => {
    const errors = getPipelineSetupExtrasErrors(
      extras({ sendEmail: true, mailTo: 'a@x.com, not-an-email', mailCC: 'also not valid' })
    );
    expect(errors.some((e) => e.includes('Mail To') && e.includes('not-an-email'))).toBe(true);
    expect(errors.some((e) => e.includes('Mail CC'))).toBe(true);
  });

  it('omits optional parameters entirely when left at their defaults', () => {
    const { code } = buildClassicReleaseSnippet(baseReleaseData, { orgUrl: 'http://x' }, extras({}));
    expect(code).not.toContain('-IncludePullRequests');
    expect(code).not.toContain('-SendEmail');
    expect(code).not.toContain('-CompareMode');
  });
});
