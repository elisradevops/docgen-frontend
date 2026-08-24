// This repo has no DOM/interaction test setup (no jsdom, no
// testing-library) — see TraceAnalysisDialog.test.jsx's own note on this.
// MUI's Dialog renders its body through a React Portal, which produces no
// output under renderToStaticMarkup without a real document to portal into
// — confirmed empirically here (an open Dialog renders only its emotion
// <style> tag, no body content at all). So, matching that same precedent,
// this only smoke-tests the closed state (proves the component constructs
// without throwing with the new sign-in-session props/imports in place).
// The removed-token-UI / new-sign-in-button content itself is covered by
// unit tests on sharePointSession.js and authPopup.js instead.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi, beforeAll } from 'vitest';

vi.mock('../../utils/sharePointSession', () => ({
  signIn: vi.fn(),
  getSessionInfo: vi.fn().mockRejectedValue(new Error('not signed in')),
}));

beforeAll(() => {
  // Deliberately does NOT stub `document` — MUI's own environment detection
  // (e.g. StyledEngineProvider) handles `document` being entirely absent in
  // this no-jsdom setup; a partial/fake stub (missing querySelector etc.)
  // makes `typeof document !== 'undefined'` true while breaking the very
  // APIs MUI then tries to call, which is worse than not stubbing at all.
  vi.stubGlobal('window', { APP_CONFIG: { JSON_DOCUMENT_URL: 'http://api-gate' }, location: { search: '' } });
});

const noop = () => {};

describe('SharePointConnectDialog (smoke)', () => {
  test('constructs without throwing when closed', async () => {
    const { default: SharePointConnectDialog } = await import('./SharePointConnectDialog');
    expect(() =>
      renderToStaticMarkup(<SharePointConnectDialog open={false} onClose={noop} onConnect={noop} />)
    ).not.toThrow();
  });

  test('constructs without throwing when open in Online mode (initialConfig with an Online siteUrl)', async () => {
    const { default: SharePointConnectDialog } = await import('./SharePointConnectDialog');
    expect(() =>
      renderToStaticMarkup(
        <SharePointConnectDialog
          open={true}
          onClose={noop}
          onConnect={noop}
          initialConfig={{ siteUrl: 'https://tenant.sharepoint.com/:f:/r/x' }}
        />
      )
    ).not.toThrow();
  });

  test('constructs without throwing when open in on-premises mode', async () => {
    const { default: SharePointConnectDialog } = await import('./SharePointConnectDialog');
    expect(() =>
      renderToStaticMarkup(<SharePointConnectDialog open={true} onClose={noop} onConnect={noop} />)
    ).not.toThrow();
  });
});
