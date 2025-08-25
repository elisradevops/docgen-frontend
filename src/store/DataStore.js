import { observable, action, makeObservable, computed } from 'mobx';
import { configureLogger, makeLoggable } from 'mobx-log';
import RestApi from './actions/AzuredevopsRestapi';
import cookies from 'js-cookies';
import {
  getBucketFileList,
  getJSONContentFromFile,
  sendDocumentTogenerator,
  createIfBucketDoesentExsist,
  uploadFileToStorage,
  deleteFile,
  getFavoriteList,
  deleteFavoriteFromDb,
  createFavorite,
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
      templateForDownload: observable,
      testPlansList: observable,
      testSuiteList: observable,
      pipelineList: observable,
      releaseDefinitionList: observable,
      releaseDefinitionHistory: observable,
      repoList: observable,
      branchesList: observable,
      pullRequestList: observable,
      gitRepoCommits: observable,
      linkTypes: observable,
      userDetails: observable,
      documents: observable,
      docType: observable,
      contextName: observable,
      loadingState: observable,
      favoriteList: observable,
      selectedFavorite: observable,
      attachmentWikiUrl: observable,
      isCustomTemplate: observable,
      requestJson: computed,
      fetchTeamProjects: action,
      setTeamProject: action,
      fetchTemplatesList: action,
      fetchTemplatesListForDownload: action,
      fetchDocuments: action,
      fetchDocFolders: action,
      setSelectedTemplate: action,
      fetchSharedQueries: action,
      setSharedQueries: action,
      fetchFieldsByType: action,
      setFieldsByType: action,
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
      setFormattingSettings: action,
      fetchPipelineRunHistory: action,
      fetchReleaseDefinitionList: action,
      setReleaseDefinitionList: action,
      fetchReleaseDefinitionHistory: action,
      fetchTestPlans: action,
      setTestPlansList: action,
      fetchTestSuitesList: action,
      setTestSuitesList: action,
      setDocType: action,
      setContextName: action,
      fetchLoadingState: action,
      uploadFile: action,
      fetchUserDetails: action,
      fetchFavoritesList: action,
      deleteFavorite: action,
      saveFavorite: action,
      loadFavorite: action,
      setAttachmentWiki: action,
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
  templateForDownload = [];
  contentControls = [];
  selectedTemplate = { key: '', name: '' };
  sharedQueries = { acquiredTrees: null }; // list of queries
  fieldsByType = [];
  linkTypes = []; // list of link types
  userDetails = [];
  linkTypesFilter = []; // list of selected links to filter by
  testPlansList = []; // list of testplans
  testSuiteList = []; // list of testsuites
  documents = []; //list of all project documents
  repoList = []; //list of all project repos
  branchesList = []; //list of all branches in repo
  pullRequestList = []; //list of all pull requests of specific repo
  gitRepoCommits = []; //commit history of a specific repo
  pipelineList = []; //list of all project pipelines
  releaseDefinitionList = []; //list of all project releaese Definitions
  releaseDefinitionHistory = []; //release history of a specific Definition
  docType = '';
  contextName = '';
  loadingState = {
    testPlanListLoading: false,
    teamProjectsLoadingState: false,
    sharedQueriesLoadingState: false,
    testSuiteListLoading: false,
    fieldsByTypeLoadingState: false,
    contentControlsLoadingState: false,
    documentsLoadingState: false,
    templatesLoadingState: false,
    gitBranchLoadingState: false,
    gitRepoLoadingState: false,
    gitRefsLoadingState: false,
    gitCommitsLoadingState: false,
    pipelineLoadingState: false,
    pullRequestLoadingState: false,
    releaseDefinitionLoadingState: false,
  };
  favoriteList = [];
  selectedFavorite = null;
  attachmentWikiUrl = ''; //for setting the wiki url for attachments
  isCustomTemplate = false;
  formattingSettings = {
    trimAdditionalSpacingInDescriptions: false,
    trimAdditionalSpacingInTables: false,
    //TODO:Add later more settings
  };

  setDocumentTypeTitle(documentType) {
    this.documentTypeTitle = documentType;
  }

  setFormattingSettings(formattingSettings) {
    this.formattingSettings = formattingSettings;
  }

  fetchDocFolders() {
    //Add loading state
    this.loadingState.contentControlsLoadingState = true;
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
      })
      .finally(() => {
        this.loadingState.contentControlsLoadingState = false;
      });
  }

  // Every time selecting a tab of a certain doctype, all the specified files from that type are returned
  async fetchDocFormsTemplates(docType) {
    //Add loading state
    this.loadingState.contentControlsLoadingState = true;
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
    } finally {
      this.loadingState.contentControlsLoadingState = false;
    }
  }

  //for fetching teamProjects
  fetchTeamProjects() {
    if (azureDevopsUrl && azuredevopsPat) {
      this.loadingState.teamProjectsLoadingState = true;
      this.azureRestClient
        .getTeamProjects()
        .then((data) => {
          this.teamProjectsList =
            data.value.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())) || [];
        })
        .catch((err) => {
          logger.error(`Error occurred while fetching team projects: ${err.message}`);
          logger.error('Error stack:');
          logger.error(err.stack);
        })
        .finally(() => {
          this.loadingState.teamProjectsLoadingState = false;
        });
    } else {
      const msg = 'Missing required cookies: azuredevopsUrl or azuredevopsPat';
      logger.error(msg);
      toast.error(msg, { autoClose: false });
    }
  }
  //for setting focused teamProject
  setTeamProject(teamProjectId, teamProjectName) {
    this.teamProject = teamProjectId;
    this.teamProjectName = teamProjectName;
    // Set the project bucket name
    if (teamProjectId !== '' && teamProjectName !== '') {
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
  }

  // For fetching template files list
  async fetchTemplatesList(docType = null, projectName = '') {
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

  fetchUserDetails() {
    this.azureRestClient.getUserDetails().then((data) => {
      if (data.identity) {
        const { DisplayName: name, TeamFoundationId: userId } = data.identity;
        logger.debug(`User details: ${name} - ${userId}`);
        this.userDetails = { name, userId };
      }
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
    // Allow clearing selection safely
    if (!templateObject) {
      this.isCustomTemplate = false;
      this.selectedTemplate = null;
      return;
    }
    // If template is not in shared folder, it means it is a custom template
    this.isCustomTemplate = templateObject?.text?.split('/')?.shift() !== 'shared';
    this.selectedTemplate = templateObject;
  }

  //for fetching shared quries
  fetchSharedQueries() {
    if (this.teamProject && this.teamProject !== '' && this.docType && this.docType !== '') {
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
  }

  //for fetching fields by type
  fetchFieldsByType(wiType) {
    if (this.teamProject) {
      this.loadingState.fieldsByTypeLoadingState = true;
      this.azureRestClient
        .getFieldsByType(this.teamProject, wiType)
        .then((data) => {
          this.setFieldsByType(data);
        })
        .catch((err) => {
          logger.error(`Error occurred while fetching fields by type: ${err.message}`);
          logger.error('Error stack:');
          logger.error(err.stack);
        })
        .finally(() => {
          this.loadingState.fieldsByTypeLoadingState = false;
        });
    }
  }

  fetchLoadingState() {
    return this.loadingState;
  }
  //for setting shared queries
  setSharedQueries(queryData) {
    this.sharedQueries.acquiredTrees = { ...queryData };
  }

  //for setting fields by type
  setFieldsByType(fieldsData) {
    this.fieldsByType = [...fieldsData];
  }

  //for fetching repo list
  fetchGitRepoList() {
    this.loadingState.gitRepoLoadingState = true;
    this.azureRestClient
      .getGitRepoList(this.teamProject)
      .then((data) => {
        this.setGitRepoList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching git repo list: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.gitRepoLoadingState = false;
      });
  }

  //for fetching repo list
  fetchGitRepoBrances(RepoId) {
    this.loadingState.gitBranchLoadingState = true;
    this.azureRestClient
      .getGitRepoBrances(RepoId, this.teamProject)
      .then((data) => {
        this.setBranchesList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching get repo branches: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.gitBranchLoadingState = false;
      });
  }

  // for setting repo list
  setGitRepoList(data) {
    this.repoList = data;
  }

  // for setting branch list
  setBranchesList(data) {
    this.branchesList = data.value || [];
  }
  //for fetching git repo commits
  async fetchGitRepoCommits(RepoId) {
    this.loadingState.gitCommitsLoadingState = true;
    try {
      return await this.azureRestClient.getGitRepoCommits(RepoId, this.teamProject);
    } catch (err) {
      logger.error(`Error occurred while fetching git repo commits: ${err.message}`);
      logger.error('Error stack:');
      logger.error(err.stack);
      return [];
    } finally {
      this.loadingState.gitCommitsLoadingState = false;
    }
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
    this.loadingState.pullRequestLoadingState = true;
    this.azureRestClient
      .getRepoPullRequests(RepoId, this.teamProject)
      .then((data) => {
        this.setRepoPullRequests(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching repo pull requests: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.pullRequestLoadingState = false;
      });
  }
  //for fetching pipeline list
  fetchPipelineList() {
    this.loadingState.pipelineLoadingState = true;
    this.azureRestClient
      .getPipelineList(this.teamProject)
      .then((data) => {
        this.setPipelineList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching pipeline list: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.pipelineLoadingState = false;
      });
  }
  //for setting pipeline list
  setPipelineList(data) {
    this.pipelineList = data.value || [];
  }
  //for fetching pipeline run history
  async fetchPipelineRunHistory(pipelineId) {
    try {
      const data = await this.azureRestClient.getPipelineRunHistory(pipelineId, this.teamProject);
      return data.value || [];
    } catch (err) {
      logger.error(`Error occurred while fetching pipeline run history: ${err.message}`);
      logger.error('Error stack:');
      logger.error(err.stack);
    }
  }

  //for fetching release list
  fetchReleaseDefinitionList() {
    this.loadingState.releaseDefinitionLoadingState = true;
    this.azureRestClient
      .getReleaseDefinitionList(this.teamProject)
      .then((data) => {
        this.setReleaseDefinitionList(data);
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching Release Definition List: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.releaseDefinitionLoadingState = false;
      });
  }
  //for setting release list
  setReleaseDefinitionList(data) {
    this.releaseDefinitionList = data.value || [];
  }
  //for fetching release history
  async fetchReleaseDefinitionHistory(releaseDefinitionId) {
    this.loadingState.releaseDefinitionLoadingState = true;
    try {
      const data = await this.azureRestClient.getReleaseDefinitionHistory(
        releaseDefinitionId,
        this.teamProject
      );
      return data.value || [];
    } catch (err) {
      logger.error(`Error occurred while fetching Release Definition History: ${err.message}`);
      logger.error('Error stack:');
      logger.error(err.stack);
    } finally {
      this.loadingState.releaseDefinitionLoadingState = false;
    }
  }

  //for fetching test plans
  fetchTestPlans() {
    this.loadingState.testPlanListLoading = true;
    this.azureRestClient
      .getTestPlansList(this.teamProject)
      .then((data) => {
        if (data.count > 0) {
          const sortedTestPlans = data.value.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
          this.setTestPlansList(sortedTestPlans);
        }
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching test plans: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.testPlanListLoading = false;
      });
  }

  //setting the testplans array
  setTestPlansList(data) {
    this.testPlansList = data || [];
  }

  fetchTestSuitesList(testPlanId) {
    this.loadingState.testSuiteListLoading = true;
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
        logger.error('Error stack:', err.stack);
      })
      .finally(() => {
        this.loadingState.testSuiteListLoading = false;
      });
  }

  setTestSuitesList(data) {
    this.testSuiteList = data || [];
  }

  get getTestSuiteList() {
    return this.testSuiteList;
  }

  //for fetching documents
  fetchDocuments() {
    this.loadingState.documentsLoadingState = true;
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
      })
      .finally(() => {
        this.loadingState.documentsLoadingState = false;
      });
  }

  //for fetching documents
  fetchTemplatesListForDownload() {
    this.loadingState.templatesLoadingState = true;
    getBucketFileList('templates', null, true, this.teamProjectName, true)
      .then((data) => {
        // Process the data to fix the URLs
        const processedData = data
          .map((item) => {
            if (item.url && this.teamProjectName) {
              // Split the URL by the project name and remove the first occurrence
              const parts = item.url.split(`/${this.teamProjectName}/`);
              item.url = parts.join(`/`);
            }
            return item;
          })
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        this.templateForDownload = processedData;
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching templates: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
      })
      .finally(() => {
        this.loadingState.templatesLoadingState = false;
      });
  }

  //Delete template file
  async deleteFileObject(file, bucketName) {
    return await deleteFile(file, this.teamProjectName, bucketName);
  }

  async fetchGitObjectRefsByType(selectedRepo, gitObjectType) {
    this.loadingState.gitRefsLoadingState = true;
    try {
      return await this.azureRestClient.GetRepoReferences(
        selectedRepo,
        this.teamProject,
        gitObjectType
      );
    } catch (err) {
      logger.error(`Error occurred while fetching git ${gitObjectType} references: ${err.message}`);
      logger.error('Error stack:');
      logger.error(err.stack);
      return [];
    } finally {
      this.loadingState.gitRefsLoadingState = false;
    }
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

    this.clearLoadedFavorite();
  };
  async sendRequestToDocGen() {
    await createIfBucketDoesentExsist(this.ProjectBucketName);
    let docReq = this.requestJson;
    return sendDocumentTogenerator(docReq);
  }

  async fetchFavoritesList() {
    this.favoriteList =
      this.userDetails?.userId && this.docType && this.teamProject
        ? await getFavoriteList(this.userDetails.userId, this.docType, this.teamProject)
        : [];
    return this.favoriteList;
  }

  async deleteFavorite(favoriteId) {
    await deleteFavoriteFromDb(favoriteId);
  }

  async saveFavorite(favName, isShared) {
    try {
      if (this.docType !== '' && this.userDetails && this.contentControls?.length > 0) {
        const item = this.contentControls[0];
        const { data: dataToSave } = item;
        // Also persist the currently selected template with the favorite
        const payload = {
          ...dataToSave,
          selectedTemplate: this.selectedTemplate || null,
          isCustomTemplate: !!this.isCustomTemplate,
        };
        await createFavorite(
          this.userDetails.userId,
          favName,
          this.docType,
          payload,
          this.teamProject,
          isShared
        );
      } else {
        logger.debug('Missing required data for saving favorite');
      }
    } catch (e) {
      toast.error(`Error while saving favorite: ${e.message}`, {
        autoClose: false,
      });
    }
  }

  clearLoadedFavorite() {
    this.selectedFavorite = null;
  }

  loadFavorite(favoriteId) {
    this.selectedFavorite = this.favoriteList.find((fav) => fav.id === favoriteId);
    try {
      const savedTemplate = this.selectedFavorite?.dataToSave?.selectedTemplate;
      if (savedTemplate) {
        // Apply the saved template selection
        this.setSelectedTemplate(savedTemplate);
      }
    } catch (e) {
      logger.error(`Error applying template from favorite: ${e.message}`);
    }
  }

  setAttachmentWiki(attachmentWikiUrl) {
    const fixedUrl = attachmentWikiUrl?.replaceAll(' ', '%20') || undefined;
    this.attachmentWikiUrl = fixedUrl;
  }

  async uploadFile(file, bucketName) {
    const formData = new FormData();
    await createIfBucketDoesentExsist(bucketName);
    formData.append('file', file);
    formData.append('docType', this.docType);
    formData.append('teamProjectName', this.teamProjectName);
    formData.append('isExternal', false);
    formData.append('bucketName', bucketName);
    return await uploadFileToStorage(formData);
  }

  setDocType(docType) {
    this.docType = docType || '';
  }

  get getDocType() {
    return this.docType;
  }

  setContextName(contextName) {
    this.contextName = contextName || '';
  }
  get getContextName() {
    return this.contextName;
  }

  getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
  }

  get requestJson() {
    const templateName =
      this.selectedTemplate?.text
        ?.split('/')
        .pop()
        .replace(/\.dotx?$/, '') || 'template';
    const tempFileName = this.isCustomTemplate
      ? `${templateName}-${this.getFormattedDate()}`
      : `${this.teamProjectName}-${this.docType}-${this.contextName}-${this.getFormattedDate()}`;
    return {
      tfsCollectionUri: azureDevopsUrl,
      PAT: azuredevopsPat,
      teamProjectName: this.teamProjectName,
      templateFile: this.selectedTemplate.url,
      uploadProperties: {
        bucketName: this.ProjectBucketName,
        fileName: tempFileName,
        createdBy: this.userDetails.name,
        enableDirectDownload: false,
      },
      contentControls: this.contentControls,
      formattingSettings: this.formattingSettings,
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
