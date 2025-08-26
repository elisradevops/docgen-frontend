import AzureRestApi from '@elisra-devops/docgen-data-provider';
import logger from '../../utils/logger';

let globalAuthErrorHandler = null;
export function setAuthErrorHandler(fn) {
  globalAuthErrorHandler = typeof fn === 'function' ? fn : null;
}

export default class AzuredevopsRestapi {
  azureRestApi;
  constructor(orgUrl, token) {
    this.azureRestApi = new AzureRestApi(orgUrl, token);
  }

  async _wrap(callFn) {
    try {
      return await callFn();
    } catch (err) {
      const status =
        err?.status || err?.response?.status || (/401/.test(`${err?.message}`) ? 401 : undefined);
      // Some environments return 302 (redirect to interactive sign-in) for invalid creds; treat as auth failure too
      if ((status === 401 || status === 302) && globalAuthErrorHandler) {
        try {
          globalAuthErrorHandler(err);
        } catch (e) {
          // avoid breaking the original error flow
        }
      }
      throw err;
    }
  }

  async getTeamProjects() {
    return this._wrap(async () => {
      let managmentDataProvider = await this.azureRestApi.getMangementDataProvider();
      return managmentDataProvider.GetProjects();
    });
  }

  async getSharedQueries(teamProjectId = null, docType = '') {
    return this._wrap(async () => {
      let ticketDataProvider = await this.azureRestApi.getTicketsDataProvider();
      return ticketDataProvider.GetSharedQueries(teamProjectId, '', docType);
    });
  }

  async getFieldsByType(teamProjectId = null, itemType = 'Test Case') {
    return this._wrap(async () => {
      let ticketDataProvider = await this.azureRestApi.getTicketsDataProvider();
      return ticketDataProvider.GetFieldsByType(teamProjectId, itemType);
    });
  }

  async getQueryResults(queryId = null, teamProjectId = '') {
    return this._wrap(async () => {
      let ticketDataProvider = await this.azureRestApi.getTicketsDataProvider();
      return ticketDataProvider.GetQueryResultById(queryId, teamProjectId);
    });
  }

  async getTestPlansList(teamProjectId = '') {
    return this._wrap(async () => {
      let testDataProvider = await this.azureRestApi.getTestDataProvider();
      return testDataProvider.GetTestPlans(teamProjectId);
    });
  }

  async getTestSuiteByPlanList(teamProjectId = '', testPlanId = '') {
    return this._wrap(async () => {
      let testDataProvider = await this.azureRestApi.getTestDataProvider();
      return testDataProvider.GetTestSuitesByPlan(teamProjectId, testPlanId, true);
    });
  }
  async getGitRepoList(teamProjectId = '') {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetTeamProjectGitReposList(teamProjectId);
    });
  }

  async getGitRepoBrances(RepoId = '', teamProjectId = '') {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetRepoBranches(teamProjectId, RepoId);
    });
  }

  async getGitRepoCommits(RepoId = '', teamProjectId = '', versionIdentifier = '') {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetCommitsForRepo(teamProjectId, RepoId, versionIdentifier);
    });
  }

  async getReleaseDefinitionList(teamProjectId = '') {
    return this._wrap(async () => {
      let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
      return pipelineDataProvider.GetAllReleaseDefenitions(teamProjectId);
    });
  }

  async getPipelineList(teamProjectId = '') {
    return this._wrap(async () => {
      let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
      return pipelineDataProvider.GetAllPipelines(teamProjectId);
    });
  }

  async getReleaseDefinitionHistory(definitionId = '', teamProjectId = '') {
    return this._wrap(async () => {
      let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
      return pipelineDataProvider.GetReleaseHistory(teamProjectId, definitionId);
    });
  }

  async getPipelineRunHistory(pipelineId = '', teamProjectId = '') {
    return this._wrap(async () => {
      let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
      return pipelineDataProvider.GetPipelineRunHistory(teamProjectId, pipelineId);
    });
  }
  async getRepoPullRequests(RepoId = '', teamProjectId = '') {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetPullRequestsForRepo(teamProjectId, RepoId);
    });
  }

  async GetRepoBranches(RepoId = '', teamProjectId = '') {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetRepoBranches(teamProjectId, RepoId);
    });
  }

  async GetRepoReferences(RepoId, teamProjectId, gitObjectType) {
    return this._wrap(async () => {
      let gitDataProvider = await this.azureRestApi.getGitDataProvider();
      return gitDataProvider.GetRepoReferences(teamProjectId, RepoId, gitObjectType);
    });
  }

  async getCollectionLinkTypes() {
    try {
      // Using wrapper to catch 401 too
      let linkTypes = await this._wrap(async () => {
        let mangementDataProvider = await this.azureRestApi.getMangementDataProvider();
        return await mangementDataProvider.GetCllectionLinkTypes();
      });
      return await linkTypes.value
        .map((link) => {
          return {
            key: link.attributes.oppositeEndReferenceName,
            text: link.name,
            selected: false,
          };
        })
        .filter((link) => {
          return (
            link.text !== 'Shared Steps' &&
            link.text !== 'Duplicate' &&
            link.text !== 'Hyperlink' &&
            link.text !== 'Artifact Link' &&
            link.text !== 'Attached File' &&
            link.text !== 'Duplicate Of' &&
            link.text !== 'Test Case'
          );
        });
    } catch (e) {
      logger.warn(`no linkTypes found - this could mean azure devops connection problems`);
      return [];
    }
  }

  async getUserDetails() {
    return this._wrap(async () => {
      let managementDataProvider = await this.azureRestApi.getMangementDataProvider();
      const res = await managementDataProvider.GetUserProfile();
      // If the response is an HTML sign-in page (redirect), convert to an auth error to be handled consistently
      if (typeof res === 'string' && /(<!DOCTYPE|<html\b)/i.test(res)) {
        const err = new Error(
          'Received sign-in HTML instead of JSON while fetching user details. Likely unauthorized.'
        );
        err.status = 401; // force global unauthorized flow
        throw err;
      }
      return res;
    });
  }
}
