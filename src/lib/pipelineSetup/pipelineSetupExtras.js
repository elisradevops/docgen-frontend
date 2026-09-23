// The handful of Invoke-SvdGeneration.ps1 / svd-job.yaml parameters that
// have no interactive equivalent in the SVD picker today (it never emails
// anything, never uploads to JFrog). Manual SVD is the baseline: Auto SVD's
// Additional settings dialog (AutoSvdAdditionalSettingsDialog.jsx) exposes
// excludedRepoNames (a real, independently useful option Manual SVD simply
// never had a control for), but deliberately leaves includePullRequests and
// includeChangeDescription out — Manual SVD's Pipeline/Release selectors
// (the only range types Auto SVD ever targets) don't expose those either,
// only CommitDateSelector.jsx does. Both stay false here (no UI control)
// purely so the builders' shared shape stays stable.

export const DEFAULT_PIPELINE_SETUP_EXTRAS = {
  // No UI control on purpose — see comment above.
  includePullRequests: false,
  includeChangeDescription: false,
  // Has a real UI control — see AutoSvdAdditionalSettingsDialog.jsx.
  excludedRepoNames: '',

  // Email — the interactive flow never sends one
  sendEmail: false,
  mailTo: '',
  mailCC: '',
  mailFrom: '',
  mailSubject: '',
  smtpServer: '',
  smtpPort: '25',

  // JFrog — mechanically different per surface (see SVDGenerationGuide.md)
  uploadToJfrog: false, // Classic Release surface
  jfrogUrl: '',
  jfrogRepo: '',
  jfrogPath: '',
  publishJfrog: true, // YAML surface
  jfrogBuildInfo: true,
};

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Splits a comma-separated address list (matching how the script itself
 * parses MailTo/MailCC — see Invoke-SvdGeneration.ps1's
 * `$MailTo -split ',' | ForEach-Object { $_.Trim() }`) and returns the
 * trimmed entries that don't look like a valid email address. Blank input
 * has no invalid entries.
 */
export function getInvalidEmails(value) {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
    .filter((address) => !EMAIL_RE.test(address));
}

/**
 * @param {object} extras - see DEFAULT_PIPELINE_SETUP_EXTRAS
 * @param {'classicRelease'|'yaml'} [surface] - unused for now (Artifactory
 *   URL/repository are optional on every surface — see below), kept for a
 *   consistent call signature with future surface-specific validation.
 */
// eslint-disable-next-line no-unused-vars
export function getPipelineSetupExtrasErrors(extras, surface) {
  const errors = [];
  if (extras.sendEmail) {
    if (!extras.mailTo?.trim()) {
      errors.push('Mail To is required when "Email the generated SVD" is on.');
    } else {
      const invalidTo = getInvalidEmails(extras.mailTo);
      if (invalidTo.length > 0) {
        errors.push(`Mail To has an invalid address: ${invalidTo.join(', ')}.`);
      }
    }
    const invalidCC = getInvalidEmails(extras.mailCC);
    if (invalidCC.length > 0) {
      errors.push(`Mail CC has an invalid address: ${invalidCC.join(', ')}.`);
    }
  }
  // Upload to Artifactory / Artifactory URL / Artifactory repository are all
  // independently optional: Invoke-SvdGeneration.ps1 falls back to its own
  // configured JfrogUrl/JfrogRepo defaults when they're left blank (see the
  // guide's own "Auto-discover releases with email" example, which enables
  // UploadToJfrog with neither field set) — the true UI flow is just
  // "upload or don't", not "upload, and also pick a location every time."
  return errors;
}
