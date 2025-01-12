import { observable, action, makeObservable, computed } from 'mobx';
import { configureLogger, makeLoggable } from 'mobx-log';
import RestApi from './actions/AzuredevopsRestapi';
import cookies from 'js-cookies';
import {
  getBucketFileList,
  getJSONContentFromFile,
  sendDocumentTogenerator,
  createIfBucketDoesentExsist,
  uploadTemplateToStorage,
} from '../store/data/docManagerApi';
import { toast } from 'react-toastify';
import logger from '../utils/logger';
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
      docType: observable,
      loadingState: observable,
      requestJson: computed,
      fetchTeamProjects: action,
      setTeamProject: action,
      fetchTemplatesList: action,
      fetchDocuments: action,
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
      setDocType: action,
      fetchLoadingState: action,
      uploadTemplateFile: action,
    });
    makeLoggable(this);
    this.fetchDocFolders();
    this.fetchTeamProjects();
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
  sharedQueries = { acquiredTrees: null }; // list of queries
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
  docType = '';
  loadingState = { sharedQueriesLoadingState: false };

  setDocumentTypeTitle(documentType) {
    this.documentTypeTitle = documentType;
  }

  fetchDocFolders() {
    getBucketFileList('document-forms')
      .then(async (data = []) => {
        await Promise.all(
          data
            .filter((file) => file.prefix !== undefined)
            .forEach((file) => {
              this.documentTypes.push(file.prefix.replace('/', ''));
            })
        );
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching bucket file list: ${err.message}`);
        logger.error('Error stack: ');
        logger.error(err.stack);
      });
  }

  // Every time selecting a tab of a certain doctype, all the specified files from that type are returned
  async fetchDocFormsTemplates(docType) {
    try {
      this.documentTemplates = [];

      // Fetch the list of document forms for the specified docType
      const data = await getBucketFileList('document-forms', docType);

      // Process each form in the fetched data
      await Promise.all(
        (data || []).map(async (form) => {
          let fileName = '';
          let folderName = '';
          if (form.name.includes('/')) {
            const formNameSections = form.name.split('/');
            if (formNameSections.length > 2) {
              return; // Skip if there are more than 2 sections
            }
            folderName = formNameSections[0];
            fileName = formNameSections[1];
          }
          // Fetch the content for each form and add it to the documentTemplates
          let jsonFormTemplate = await getJSONContentFromFile('document-forms', folderName, fileName);
          this.documentTemplates.push(jsonFormTemplate);
        })
      );

      // Return the documentTemplates after fetching is complete
      return this.documentTemplates;
    } catch (err) {
      logger.error(`Error occurred while fetching fetchDocFormsTemplates: ${err.message}`);
      logger.error('Error stack:');
      logger.error(err.stack);
    }
  }

  //for fetching teamProjects
  fetchTeamProjects() {
    if (azureDevopsUrl && azuredevopsPat) {
      this.azureRestClient
        .getTeamProjects()
        .then((data) => {
          this.teamProjectsList = data.value.sort((a, b) => (a.name > b.name ? 1 : -1)) || [];
        })
        .catch((err) => {
          logger.error(`Error occurred while fetching team projects: ${err.message}`);
          logger.error('Error stack:');
          logger.error(err.stack);
        });
    } else {
      const msg = 'Missing required cookies: azuredevopsUrl or azuredevopsPat';
      logger.error(msg);
      toast.error(msg);
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
    this.fetchTestPlans();
    this.fetchGitRepoList();
    this.fetchPipelineList();
    this.fetchReleaseDefinitionList();
  }

  // For fetching template files list
  async fetchTemplatesList(docType, projectName = '') {
    this.templateList = [];
    try {
      const projects = projectName !== '' ? ['shared', projectName] : ['shared'];

      // Fetch templates concurrently for all projects
      const allTemplates = await Promise.all(
        projects.map(async (proj) => {
          const data = await getBucketFileList('templates', docType, false, proj);
          return data || []; // Return an empty array if no data
        })
      );

      // Flatten the array of template lists
      this.templateList = allTemplates.flat();
    } catch (e) {
      logger.error(`Error occurred while fetching templates: ${e.message}`);
      logger.error(`Error stack: `);
      logger.error(e.stack);
    } finally {
      // Return the template list after all templates have been processed
      return this.templateList;
    }
  }

  //for fetching all the collections links
  fetchCollectionLinkTypes() {
    this.azureRestClient.getCollectionLinkTypes().then((data) => {
      this.linkTypes = data || [];
    });
  }
  //for setting the selected link type filters
  updateSelectedLinksFilter = (selectedLinkType) => {
    logger.debug(`selected linked Type ${JSON.stringify(selectedLinkType)}`);
    let linkIndex = this.linkTypesFilter.findIndex((linkFilter) => linkFilter.key === selectedLinkType.key);
    if (linkIndex >= 0) {
      this.linkTypesFilter[linkIndex] = selectedLinkType;
    } else {
      this.linkTypesFilter.push(selectedLinkType);
    }
    logger.debug(`selected Link Types Filter ${JSON.stringify(this.linkTypesFilter)}`);
  };
  //for setting selected template
  setSelectedTemplate(templateObject) {
    this.selectedTemplate = templateObject;
  }

  //for fetching shared quries
  fetchSharedQueries() {
    this.loadingState.sharedQueriesLoadingState = true;
    this.azureRestClient
      .getSharedQueries(this.teamProject, this.docType)
      .then((data) => {
        this.setSharedQueries(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching queries: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.sharedQueriesLoadingState = false;
      });
  }

  fetchLoadingState() {
    return this.loadingState;
  }
  //for setting shared queries
  setSharedQueries(queryData) {
    this.sharedQueries.acquiredTrees = { ...queryData };
  }
  //for fetching repo list
  fetchGitRepoList() {
    this.azureRestClient
      .getGitRepoList(this.teamProject)
      .then((data) => {
        this.setGitRepoList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching git repo list: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }

  //for fetching repo list
  fetchGitRepoBrances(RepoId) {
    this.azureRestClient
      .getGitRepoBrances(RepoId, this.teamProject)
      .then((data) => {
        this.setBranchesList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching get repo branches: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
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
    this.azureRestClient
      .getGitRepoCommits(RepoId, this.teamProject, branchName)
      .then((data) => {
        this.setGitRepoCommits(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching git repo commits: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
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
    this.azureRestClient
      .getRepoPullRequests(RepoId, this.teamProject)
      .then((data) => {
        this.setRepoPullRequests(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching repo pull requests: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
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
    this.azureRestClient
      .getPipelineRunHistory(pipelineId, this.teamProject)
      .then((data) => {
        this.setPipelineRunHistory(data);
        logger.debug(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching pipeline run history: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }
  //for setting pipeline run history
  setPipelineRunHistory(data) {
    this.pipelineRunHistory = data.value || [];
  }
  //for fetching release list
  fetchReleaseDefinitionList() {
    this.azureRestClient
      .getReleaseDefinitionList(this.teamProject)
      .then((data) => {
        this.setReleaseDefinitionList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching Release Definition List: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }
  //for setting release list
  setReleaseDefinitionList(data) {
    this.releaseDefinitionList = data.value || [];
  }
  //for fetching release history
  fetchReleaseDefinitionHistory(releaseDefinitionId) {
    this.azureRestClient
      .getReleaseDefinitionHistory(releaseDefinitionId, this.teamProject)
      .then((data) => {
        this.setReleaseDefinitionHistory(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching Release Definition History: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }
  //for setting release history
  setReleaseDefinitionHistory(data) {
    this.releaseDefinitionHistory = data.value || [];
  }
  //for fetching test plans
  fetchTestPlans() {
    this.azureRestClient
      .getTestPlansList(this.teamProject)
      .then((data) => {
        this.setTestPlansList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching test plans: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }

  //setting the testplans array
  setTestPlansList(data) {
    this.testPlansList = data.value || [];
  }

  fetchTestSuitesList(testPlanId) {
    this.azureRestClient
      .getTestSuiteByPlanList(this.teamProject, testPlanId)
      .then((data) => {
        data.sort(function (a, b) {
          return a.parent - b.parent;
        });
        this.setTestSuitesList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching test suites list: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      });
  }

  setTestSuitesList(data) {
    this.testSuiteList = data || [];
  }

  //for fetching documents
  fetchDocuments() {
    getBucketFileList(this.ProjectBucketName, null, true)
      .then((data) => {
        data.sort(function (a, b) {
          return new Date(b.lastModified) - new Date(a.lastModified);
        });
        this.documents = data;
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching documents: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
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
  };
  async sendRequestToDocGen() {
    await createIfBucketDoesentExsist(this.ProjectBucketName);
    let docReq = this.requestJson;
    return sendDocumentTogenerator(docReq);
  }

  async uploadTemplateFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', this.docType);
    formData.append('teamProjectName', this.teamProjectName);
    formData.append('isExternal', false);
    return await uploadTemplateToStorage(formData);
  }

  setDocType(docType) {
    this.docType = docType || '';
  }

  get getDocType() {
    return this.docType;
  }

  get requestJson() {
    let tempFileName = `${this.teamProjectName}-${this.docType}-${new Date()
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
