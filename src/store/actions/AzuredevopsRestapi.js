import AzureRestApi from '@doc-gen/dg-data-provider-azuredevops';

export default class AzuredevopsRestapi {
  azureRestApi;
  constructor(orgUrl, token) {
    this.azureRestApi = new AzureRestApi(orgUrl, token);
  }
  async getTeamProjects() {
    let managmentDataProvider = await this.azureRestApi.getMangementDataProvider();
    return managmentDataProvider.GetProjects();
  }

  async getSharedQueries(teamProjectId = null) {
    let ticketDataProvider = await this.azureRestApi.getTicketsDataProvider();
    return ticketDataProvider.GetSharedQueries(teamProjectId, '');
  }

  async getQueryResults(queryId = null, teamProjectId = '') {
    let ticketDataProvider = await this.azureRestApi.getTicketsDataProvider();
    return ticketDataProvider.GetQueryResultById(queryId, teamProjectId);
  }

  async getTestPlansList(teamProjectId = '') {
    let testDataProvider = await this.azureRestApi.getTestDataProvider();
    return testDataProvider.GetTestPlans(teamProjectId);
  }

  async getTestSuiteByPlanList(teamProjectId = '', testPlanId = '') {
    let testDataProvider = await this.azureRestApi.getTestDataProvider();
    return testDataProvider.GetTestSuitesByPlan(teamProjectId, testPlanId, true);
  }
  async getGitRepoList(teamProjectId = '') {
    let gitDataProvider = await this.azureRestApi.getGitDataProvider();
    return gitDataProvider.GetTeamProjectGitReposList(teamProjectId);
  }

  async getGitRepoBrances(RepoId = '', teamProjectId = '') {
    let gitDataProvider = await this.azureRestApi.getGitDataProvider();
    return gitDataProvider.GetRepoBranches(teamProjectId, RepoId);
  }

  async getGitRepoCommits(RepoId = '', teamProjectId = '', branchName = '') {
    let gitDataProvider = await this.azureRestApi.getGitDataProvider();
    return gitDataProvider.GetCommitsForRepo(teamProjectId, RepoId, branchName);
  }

  async getReleaseDefinitionList(teamProjectId = '') {
    let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
    return pipelineDataProvider.GetAllReleaseDefenitions(teamProjectId);
  }

  async getPipelineList(teamProjectId = '') {
    let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
    return pipelineDataProvider.GetAllPipelines(teamProjectId);
  }

  async getReleaseDefinitionHistory(definitionId = '', teamProjectId = '') {
    let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
    return pipelineDataProvider.GetReleaseHistory(teamProjectId, definitionId);
  }

  async getPipelineRunHistory(pipelineId = '', teamProjectId = '') {
    let pipelineDataProvider = await this.azureRestApi.getPipelinesDataProvider();
    return pipelineDataProvider.GetPipelineRunHistory(teamProjectId, pipelineId);
  }
  async getRepoPullRequests(RepoId = '', teamProjectId = '') {
    let gitDataProvider = await this.azureRestApi.getGitDataProvider();
    return gitDataProvider.GetPullRequestsForRepo(teamProjectId, RepoId);
  }

  async GetRepoBranches(RepoId = '', teamProjectId = '') {
    let gitDataProvider = await this.azureRestApi.getGitDataProvider();
    return gitDataProvider.GetRepoBranches(teamProjectId, RepoId);
  }

  async getCollectionLinkTypes() {
    try {
      let mangementDataProvider = this.azureRestApi.getMangementDataProvider();
      let linkTypes = await mangementDataProvider.GetCllectionLinkTypes();
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
      console.warn(`no linkTypes found - this could mean azure devops connection problems`);
      return [];
    }
  }
}
