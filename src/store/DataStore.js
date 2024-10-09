import { observable, action, makeObservable, computed } from 'mobx';
import { configureLogger } from 'mobx-log';
import RestApi from './actions/AzuredevopsRestapi';
import cookies from 'js-cookies';
import {
  getBucketFileList,
  getJSONContentFromFile,
  sendDocumentTogenerator,
  createIfBucketDoesentExsist,
} from '../store/data/docManagerApi';

const azureDevopsUrl = cookies.getItem('azuredevopsUrl');
const azuredevopsPat = cookies.getItem('azuredevopsPat');
class DocGenDataStore {
  azureRestClient = new RestApi(azureDevopsUrl, azuredevopsPat);

  constructor() {
    makeObservable(this, {
      documentTypeTitle: observable,
      documentTemplates: observable,
      documentTypes: observable,
      teamProject: observable,
      selectedTemplate: observable,
      contentControls: observable,
      sharedQueries: observable,
      teamProjectsList: observable,
      templateList: observable,
      testPlansList: observable,
      testSuiteList: observable,
      pipelineList: observable,
      pipelineRunHistory: observable,
      releaseDefinitionList: observable,
      releaseDefinitionHistory: observable,
      repoList: observable,
      branchesList: observable,
      pullRequestList: observable,
      gitRepoCommits: observable,
      linkTypes: observable,
      documents: observable,
      requestJson: computed,
      fetchTeamProjects: action,
      setTeamProject: action,
      fetchTemplatesList: action,
      fetchDocFolders: action,
      setSelectedTemplate: action,
      fetchSharedQueries: action,
      setSharedQueries: action,
      fetchGitRepoList: action,
      fetchGitRepoBrances: action,
      setGitRepoList: action,
      setBranchesList: action,
      fetchRepoPullRequests: action,
      setRepoPullRequests: action,
      fetchGitRepoCommits: action,
      setGitRepoCommits: action,
      fetchPipelineList: action,
      setPipelineList: action,
      fetchPipelineRunHistory: action,
      setPipelineRunHistory: action,
      fetchReleaseDefinitionList: action,
      setReleaseDefinitionList: action,
      fetchReleaseDefinitionHistory: action,
      setReleaseDefinitionHistory: action,
      fetchTestPlans: action,
      setTestPlansList: action,
      fetchTestSuitesList: action,
      setTestSuitesList: action,
    });

    //TODO: need to call this manually when needed
    //this.fetchDocTemplates();
    this.fetchDocFolders();
    this.fetchTeamProjects();
    this.fetchTemplatesList();
    this.fetchCollectionLinkTypes();
  }

  documentTypeTitle = '';
  documentTypes = [];
  documentTemplates = [];
  teamProjectsList = [];
  teamProject = '';
  teamProjectName = '';
  ProjectBucketName = '';
  templateList = [];
  contentControls = [];
  selectedTemplate = { key: '', name: '' };
  sharedQueries = []; // list of queries
  linkTypes = []; // list of link types
  linkTypesFilter = []; // list of selected links to filter by
  testPlansList = []; // list of testplans
  testSuiteList = []; // list of testsuites
  documents = []; //list of all project documents
  repoList = []; //list of all project repos
  branchesList = []; //list of all branches in repo
  pullRequestList = []; //list of all pull requests of specific repo
  gitRepoCommits = []; //commit history of a specific repo
  pipelineList = []; //list of all project pipelines
  pipelineRunHistory = []; //pipeline history of a specific pipeline
  releaseDefinitionList = []; //list of all project releaese Definitions
  releaseDefinitionHistory = []; //release history of a specific Definition

  setDocumentTypeTitle(documentType) {
    this.documentTypeTitle = documentType;
  }

  fetchDocFolders() {
    getBucketFileList('document-forms').then(async (data = []) => {
      await Promise.all(
        data
          .filter((file) => file.prefix !== undefined)
          .forEach((file) => {
            this.documentTypes.push(file.prefix.replace('/', ''));
          })
      );
    });
  }

  //Every time selecting a tab of a certain doctype then all the specified files from that type are returned
  fetchDocTemplates(docType) {
    this.documentTemplates = [];
    getBucketFileList('document-forms', docType).then(async (data = []) => {
      await Promise.all(
        data.map(async (form) => {
          let fileName = '';
          let folderName = '';
          if (form.name.includes('/')) {
            const formNameSections = form.name.split('/');
            if (formNameSections.length > 2) {
              return;
            }
            folderName = formNameSections[0];
            fileName = formNameSections[1];
          }
          let jsonFormTemplate = await getJSONContentFromFile('document-forms', folderName, fileName);
          this.documentTemplates.push(jsonFormTemplate);
        })
      );
    });
  }

  //for fetching teamProjects
  fetchTeamProjects() {
    if (azureDevopsUrl && azuredevopsPat) {
      this.azureRestClient.getTeamProjects().then((data) => {
        console.log(data);
        this.teamProjectsList = data.value.sort((a, b) => (a.name > b.name ? 1 : -1)) || [];
      });
    } else {
      console.error('Missing required cookies: azuredevopsUrl or azuredevopsPat');
    }
  }
  //for setting focused teamProject
  setTeamProject(teamProjectId, teamProjectName) {
    this.teamProject = teamProjectId;
    this.teamProjectName = teamProjectName;
    this.ProjectBucketName = teamProjectName.toLowerCase();
    this.ProjectBucketName = this.ProjectBucketName.replace('_', '-');
    this.ProjectBucketName = this.ProjectBucketName.replace(/[^a-z0-9-]/g, '');
    if (this.ProjectBucketName.length < 3) {
      this.ProjectBucketName = this.ProjectBucketName + '-bucket';
    }
    this.fetchDocuments();
    this.fetchSharedQueries();
    this.fetchTestPlans();
    this.fetchGitRepoList();
    this.fetchPipelineList();
    this.fetchReleaseDefinitionList();
  }
  //for fetching templatefiles list
  fetchTemplatesList() {
    getBucketFileList('templates').then((data) => {
      this.templateList = data || [];
    });
  }
  //for fetching all the collections links
  fetchCollectionLinkTypes() {
    this.azureRestClient.getCollectionLinkTypes().then((data) => {
      this.linkTypes = data || [];
    });
  }
  //for setting the selected link type filters
  updateSelectedLinksFilter = (selectedLinkType) => {
    console.log(JSON.stringify(selectedLinkType));
    let linkIndex = this.linkTypesFilter.findIndex((linkFilter) => linkFilter.key === selectedLinkType.key);
    if (linkIndex >= 0) {
      this.linkTypesFilter[linkIndex] = selectedLinkType;
    } else {
      this.linkTypesFilter.push(selectedLinkType);
    }
    console.log(this.linkTypesFilter);
  };
  //for setting selected template
  setSelectedTemplate(templateObject) {
    this.selectedTemplate = templateObject;
  }
  //for fetching shared quries
  fetchSharedQueries() {
    this.azureRestClient.getSharedQueries(this.teamProject).then((data) => {
      this.setSharedQueries(data);
    });
  }
  //for setting shared queries
  setSharedQueries(data) {
    this.sharedQueries = data;
  }
  //for fetching repo list
  fetchGitRepoList() {
    this.azureRestClient.getGitRepoList(this.teamProject).then((data) => {
      this.setGitRepoList(data);
    });
  }

  //for fetching repo list
  fetchGitRepoBrances(RepoId) {
    this.azureRestClient.getGitRepoBrances(RepoId, this.teamProject).then((data) => {
      this.setBranchesList(data);
    });
  }

  // for setting repo list
  setGitRepoList(data) {
    this.repoList = data.value || [];
  }

  // for setting branch list
  setBranchesList(data) {
    this.branchesList = data.value || [];
  }
  //for fetching git repo commits
  fetchGitRepoCommits(RepoId, branchName) {
    this.azureRestClient.getGitRepoCommits(RepoId, this.teamProject, branchName).then((data) => {
      this.setGitRepoCommits(data);
    });
  }
  //for setting git repo commits
  setGitRepoCommits(data) {
    this.gitRepoCommits = data.value || [];
  }
  //for setting repo pull requests
  setRepoPullRequests(data) {
    this.pullRequestList = data.value || [];
  }
  //for fetching repo pull requests
  fetchRepoPullRequests(RepoId) {
    this.azureRestClient.getRepoPullRequests(RepoId, this.teamProject).then((data) => {
      this.setRepoPullRequests(data);
    });
  }
  //for fetching pipeline list
  fetchPipelineList() {
    this.azureRestClient.getPipelineList(this.teamProject).then((data) => {
      this.setPipelineList(data);
    });
  }
  //for setting pipeline list
  setPipelineList(data) {
    this.pipelineList = data.value || [];
  }
  //for fetching pipeline run history
  fetchPipelineRunHistory(pipelineId) {
    this.azureRestClient.getPipelineRunHistory(pipelineId, this.teamProject).then((data) => {
      this.setPipelineRunHistory(data);
      console.log(data);
    });
  }
  //for setting pipeline run history
  setPipelineRunHistory(data) {
    this.pipelineRunHistory = data.value || [];
  }
  //for fetching release list
  fetchReleaseDefinitionList() {
    this.azureRestClient.getReleaseDefinitionList(this.teamProject).then((data) => {
      this.setReleaseDefinitionList(data);
    });
  }
  //for setting release list
  setReleaseDefinitionList(data) {
    this.releaseDefinitionList = data.value || [];
  }
  //for fetching release history
  fetchReleaseDefinitionHistory(releaseDefinitionId) {
    this.azureRestClient.getReleaseDefinitionHistory(releaseDefinitionId, this.teamProject).then((data) => {
      this.setReleaseDefinitionHistory(data);
    });
  }
  //for setting release history
  setReleaseDefinitionHistory(data) {
    this.releaseDefinitionHistory = data.value || [];
  }
  //for fetching test plans
  fetchTestPlans() {
    this.azureRestClient.getTestPlansList(this.teamProject).then((data) => {
      this.setTestPlansList(data);
    });
  }

  //setting the testplans array
  setTestPlansList(data) {
    this.testPlansList = data.value || [];
  }

  fetchTestSuitesList(testPlanId) {
    this.azureRestClient.getTestSuiteByPlanList(this.teamProject, testPlanId).then((data) => {
      data.sort(function (a, b) {
        return a.parent - b.parent;
      });
      this.setTestSuitesList(data);
    });
  }

  setTestSuitesList(data) {
    this.testSuiteList = data || [];
  }

  //for fetching documents
  fetchDocuments() {
    getBucketFileList(this.ProjectBucketName, null, true).then((data) => {
      data.sort(function (a, b) {
        return new Date(b.lastModified) - new Date(a.lastModified);
      });
      this.documents = data;
    });
  }

  //add a content control object to the doc object
  addContentControlToDocument = (contentControlObject, arrayIndex = null) => {
    //adding link types filterss to contetn control
    //TODO: not the best implementation - in case there are multiple link selector might cause issues
    if (this.linkTypesFilter.length > 0) {
      let linkTypeFilterArray = this.linkTypesFilter
        .map((filter) => {
          return filter.selected ? filter.key : null;
        })
        .filter((link) => link !== null);
      contentControlObject.data.linkTypeFilterArray = linkTypeFilterArray;
    }
    //zeroing down the filter object
    this.linkTypesFilter = [];
    if (arrayIndex !== null) {
      this.contentControls[arrayIndex] = contentControlObject;
    } else {
      this.contentControls.push(contentControlObject);
    }
    console.log(contentControlObject);
  };
  async sendRequestToDocGen() {
    await createIfBucketDoesentExsist(this.ProjectBucketName);
    let docReq = this.requestJson;
    console.log(docReq);
    return sendDocumentTogenerator(docReq);
  }

  get requestJson() {
    let tempFileName = `${this.teamProjectName}-${new Date()
      .toISOString()
      .substring(0, 19)
      .replace('T', '-')}`;
    return {
      tfsCollectionUri: azureDevopsUrl,
      PAT: azuredevopsPat,
      teamProjectName: this.teamProjectName,
      templateFile: this.selectedTemplate.url,
      uploadProperties: {
        bucketName: this.ProjectBucketName,
        fileName: tempFileName,
      },
      contentControls: this.contentControls,
    };
  }
  getTeamProjectsList() {
    return this.teamProjectsList;
  }
}

const config = {
  actions: true, // Log actions
  reactions: false, // Don't log reactions
  transactions: false, // Don't log transactions
  computeds: true, // Log computed values
};
configureLogger(config);

var store = new DocGenDataStore();

export default store;
