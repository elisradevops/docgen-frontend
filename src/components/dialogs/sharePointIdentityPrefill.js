// Pure decision logic for prefilling the on-prem SharePoint NTLM dialog's
// Username/Domain fields from a resolved ADO identity hint. Extracted so
// it's testable without a DOM (this repo has no jsdom/RTL) — mirrors the
// existing queryTreeUtils.js + QueryTree.test.jsx pattern for exactly this
// "pull the pure logic out of the component" situation.
export const resolveIdentityPrefill = ({ hint, username, domain }) => ({
  username: String(username || '').trim() ? username : hint?.account || '',
  domain: String(domain || '').trim() ? domain : hint?.domain || '',
});
