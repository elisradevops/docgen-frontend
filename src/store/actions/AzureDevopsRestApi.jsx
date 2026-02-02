import axios from 'axios';
import { enqueueRequest } from '../../utils/requestQueue';
import C from '../constants';
import logger from '../../utils/logger';
import { setLastApiError } from '../../utils/debug';

let globalAuthErrorHandler = null;
export function setAuthErrorHandler(fn) {
  globalAuthErrorHandler = typeof fn === 'function' ? fn : null;
}

export default class AzureDevopsRestApi {
  constructor(orgUrl, token) {
    // Store credentials; included on every request via headers (similar to docManagerApi style)
    this.orgUrl = orgUrl;
    this.pat = token;
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      // Pass org and PAT to the API gateway; adjust header names to what your gateway expects
      'X-Ado-Org-Url': this.orgUrl || '',
      'X-Ado-PAT': this.pat || '',
    };
  }

  _normalizeTeamProjectId(value) {
    let raw = String(value || '').trim();
    if (!raw) return '';
    for (let i = 0; i < 3; i += 1) {
      if (!/%[0-9A-Fa-f]{2}/.test(raw)) break;
      try {
        const decoded = decodeURIComponent(raw);
        if (decoded === raw) break;
        raw = decoded;
      } catch {
        break;
      }
    }
    return raw;
  }

  async _wrap(callFn, options = {}) {
    try {
      return await enqueueRequest(callFn, { key: 'ado', ...options });
    } catch (err) {
      const status =
        err?.status || err?.response?.status || (/401/.test(`${err?.message}`) ? 401 : undefined);
      try {
        setLastApiError({
          url: err?.config?.url,
          message: err?.message || 'Request failed',
          status,
        });
      } catch {
        /* empty */
      }
      // Some environments return 302 (redirect to interactive sign-in) for invalid creds; treat as auth failure too
      if ((status === 401 || status === 302) && globalAuthErrorHandler) {
        try {
          globalAuthErrorHandler(err);
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // avoid breaking the original error flow
        }
      }
      throw err;
    }
  }

  async getTeamProjects() {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/projects`, {
        headers: this._headers(),
      });
      return res.data;
    });
  }

  async getSharedQueries(teamProjectId = null, docType = '') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/queries`, {
        headers: this._headers(),
        //Add my Queries for debugging
        // params: { teamProjectId, docType, path: 'My Queries' },
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId), docType, path: '' },
      });
      return res.data;
    });
  }

  async getFieldsByType(teamProjectId = null, itemType = 'Test Case') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/fields`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId), type: itemType },
      });
      return res.data;
    });
  }

  async getQueryResults(queryId = null, teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/queries/${encodeURIComponent(queryId || '')}/results`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
        }
      );
      return res.data;
    });
  }

  async getTestPlansList(teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/tests/plans`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
    });
  }

  async getTestSuiteByPlanList(teamProjectId = '', testPlanId = '') {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/tests/plans/${encodeURIComponent(testPlanId || '')}/suites`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId), includeChildren: true },
        }
      );
      return res.data;
    });
  }
  async getGitRepoList(teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/git/repos`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
    });
  }

  async getGitRepoBranches(RepoId = '', teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/git/repos/${encodeURIComponent(RepoId || '')}/branches`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
        }
      );
      return res.data;
    });
  }

  async getGitRepoCommits(RepoId = '', teamProjectId = '', versionIdentifier = '') {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/git/repos/${encodeURIComponent(RepoId || '')}/commits`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId), versionIdentifier },
        }
      );
      return res.data;
    });
  }

  async getReleaseDefinitionList(teamProjectId = '') {
    return this._wrap(
      async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/pipelines/releases/definitions`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
      },
      { priority: 'low' }
    );
  }

  async getPipelineList(teamProjectId = '') {
    return this._wrap(
      async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/pipelines`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
      },
      { priority: 'low' }
    );
  }

  async getReleaseDefinitionHistory(definitionId = '', teamProjectId = '') {
    return this._wrap(
      async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/pipelines/releases/definitions/${encodeURIComponent(
          definitionId || ''
        )}/history`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
        }
      );
      return res.data;
      },
      { priority: 'low' }
    );
  }

  async getPipelineRunHistory(pipelineId = '', teamProjectId = '') {
    return this._wrap(
      async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/pipelines/${encodeURIComponent(pipelineId || '')}/runs`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
        }
      );
      return res.data;
      },
      { priority: 'low' }
    );
  }
  async getRepoPullRequests(RepoId = '', teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/git/repos/${encodeURIComponent(RepoId || '')}/pull-requests`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
        }
      );
      return res.data;
    });
  }

  async getWorkItemTypeList(teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/work-item-types`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
    });
  }

  async GetRepoBranches(RepoId = '', teamProjectId = '') {
    return this.getGitRepoBranches(RepoId, teamProjectId);
  }

  async GetRepoReferences(RepoId, teamProjectId, gitObjectType) {
    return this._wrap(async () => {
      const res = await axios.get(
        `${C.jsonDocument_url}/azure/git/repos/${encodeURIComponent(RepoId || '')}/refs`,
        {
          headers: this._headers(),
          params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId), type: gitObjectType },
        }
      );
      return res.data;
    });
  }

  async getCollectionLinkTypes() {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/link-types`, {
        headers: this._headers(),
      });
      const linkTypes = res.data;
      const items = Array.isArray(linkTypes?.value)
        ? linkTypes.value
        : Array.isArray(linkTypes)
        ? linkTypes
        : [];
      return items
        .map((link) => ({
          key: link?.attributes?.oppositeEndReferenceName || link?.key || link?.id,
          text: link?.name || link?.text,
          selected: false,
        }))
        .filter(
          (link) =>
            ![
              'Shared Steps',
              'Duplicate',
              'Hyperlink',
              'Artifact Link',
              'Attached File',
              'Duplicate Of',
              'Test Case',
            ].includes(link.text)
        );
    }).catch(() => {
      logger.warn(`no linkTypes found - this could mean azure devops connection problems`);
      return [];
    });
  }

  async getUserDetails() {
    return this._wrap(
      async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/user/profile`, {
        headers: this._headers(),
      });
      // If server inadvertently returns HTML, convert to auth error like before
      if (typeof res?.data === 'string' && /(<!DOCTYPE|<html\b)/i.test(res.data)) {
        const err = new Error(
          'Received sign-in HTML instead of JSON while fetching user details. Likely unauthorized.'
        );
        err.status = 401;
        throw err;
      }
      return res.data;
      },
      { priority: 'high' }
    );
  }

  async getWorkItemTypes(teamProjectId = '') {
    return this._wrap(async () => {
      const res = await axios.get(`${C.jsonDocument_url}/azure/work-item-types`, {
        headers: this._headers(),
        params: { teamProjectId: this._normalizeTeamProjectId(teamProjectId) },
      });
      return res.data;
    });
  }
}
