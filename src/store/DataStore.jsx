import { observable, action, makeObservable, computed } from 'mobx';
import { configureLogger, makeLoggable } from 'mobx-log';
import RestApi, { setAuthErrorHandler } from './actions/AzureDevopsRestApi';
import cookies from 'js-cookies';
import {
  getBucketFileList,
  getJSONContentFromFile,
  sendDocumentToGenerator,
  createIfBucketDoesNotExist,
  uploadFileToStorage,
  deleteFile,
  getFavoriteList,
  deleteFavoriteFromDb,
  createFavorite,
} from '../store/data/docManagerApi';
import { toast } from 'react-toastify';
import logger from '../utils/logger';
const sanitizeCookie = (v) => {
  if (v == null) return '';
  const s = String(v).trim();
  return s === 'null' || s === 'undefined' ? '' : s;
};
const azureDevopsUrl = sanitizeCookie(cookies.getItem('azureDevopsUrl'));
const azureDevopsPat = sanitizeCookie(cookies.getItem('azureDevopsPat'));
class DocGenDataStore {
  azureRestClient = new RestApi(azureDevopsUrl, azureDevopsPat);

  constructor() {
    makeObservable(this, {
      documentTypeTitle: observable,
      documentTemplates: observable,
      documentTypes: observable,
      showDebugDocs: observable,
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
      workItemTypes: observable,
      userDetails: observable,
      documents: observable,
      docType: observable,
      contextName: observable,
      loadingState: observable,
      favoriteList: observable,
      selectedFavorite: observable,
      attachmentWikiUrl: observable,
      isCustomTemplate: observable,
      // validation state for UI components by contentControlIndex
      validationStates: observable,
      // auth-related
      isAuthenticated: observable,
      lastAuthErrorStatus: observable,
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
      fetchGitRepoBranches: action,
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
      fetchWorkItemTypeList: action,
      fetchTestPlans: action,
      setTestPlansList: action,
      fetchTestSuitesList: action,
      setTestSuitesList: action,
      setDocType: action,
      setContextName: action,
      fetchLoadingState: action,
      uploadFile: action,
      fetchUserDetails: action,
      testCredentials: action,
      setCredentials: action,
      fetchFavoritesList: action,
      deleteFavorite: action,
      saveFavorite: action,
      loadFavorite: action,
      setAttachmentWiki: action,
      // validation actions
      setValidationState: action,
      clearValidationForIndex: action,
      // debug-docs actions
      setShowDebugDocs: action,
      recomputeDocumentTypes: action,
    });
    makeLoggable(this);
    // Global 401 handler -> set flags and dispatch event for UI to react
    setAuthErrorHandler(() => {
      if (this.lastAuthErrorStatus !== 401) {
        this.lastAuthErrorStatus = 401;
      }
      this.isAuthenticated = false;
      try {
        window.dispatchEvent(new CustomEvent('auth-unauthorized'));
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // no-op in non-browser contexts
      }
    });
    // Ensure client is initialized from current cookies (module-level reads may be stale at import time)
    try {
      const urlFromCookies = sanitizeCookie(cookies.getItem('azureDevopsUrl'));
      const patFromCookies = sanitizeCookie(cookies.getItem('azureDevopsPat'));
      if (urlFromCookies && patFromCookies) {
        this.setCredentials(urlFromCookies, patFromCookies);
      }
    } catch {
      /* empty */
    }
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
  testPlansList = []; // list of testPlans
  testSuiteList = []; // list of testsuites
  documents = []; //list of all project documents
  repoList = []; //list of all project repos
  branchesList = []; //list of all branches in repo
  pullRequestList = []; //list of all pull requests of specific repo
  gitRepoCommits = []; //commit history of a specific repo
  pipelineList = []; //list of all project pipelines
  releaseDefinitionList = []; //list of all project release Definitions
  releaseDefinitionHistory = []; //release history of a specific Definition
  workItemTypes = [];
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
    workItemTypesLoadingState: false,
  };
  favoriteList = [];
  selectedFavorite = null;
  attachmentWikiUrl = ''; //for setting the wiki url for attachments
  isCustomTemplate = false;
  // Validation states keyed by contentControlIndex: { [index]: { [key]: { isValid: boolean, message: string } } }
  validationStates = {};
  // auth-related state
  isAuthenticated = false;
  lastAuthErrorStatus = null; // e.g., 401 when PAT is invalid/expired
  formattingSettings = {
    trimAdditionalSpacingInDescriptions: false,
    trimAdditionalSpacingInTables: false,
    //TODO:Add later more settings
  };

  // Toggle for showing debug document types (hidden by default)
  showDebugDocs = false;
  // Metadata per document type (tabIndex, isDebug)
  docTypeMeta = {};

  setDocumentTypeTitle(documentType) {
    this.documentTypeTitle = documentType;
  }

  setFormattingSettings(formattingSettings) {
    this.formattingSettings = formattingSettings;
  }

  // Update the underlying Azure DevOps client when credentials change (e.g., after login)
  setCredentials(orgUrl, pat) {
    const normalizedUrl = (orgUrl || '').endsWith('/') ? orgUrl : `${orgUrl || ''}/`;
    this.azureRestClient = new RestApi(normalizedUrl, pat);
  }

  // Toggle visibility of debug document types and recompute the visible list
  setShowDebugDocs(value) {
    this.showDebugDocs = !!value;
    this.recomputeDocumentTypes();
  }

  // Recompute documentTypes from docTypeMeta, applying filtering and sorting
  recomputeDocumentTypes() {
    const allDocTypes = Object.keys(this.docTypeMeta || {});
    const visible = allDocTypes.filter((dt) => {
      const meta = this.docTypeMeta[dt] || {};
      return this.showDebugDocs ? true : !meta.isDebug;
    });
    visible.sort((a, b) => {
      const ai = this.docTypeMeta[a]?.tabIndex ?? Number.POSITIVE_INFINITY;
      const bi = this.docTypeMeta[b]?.tabIndex ?? Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
    this.documentTypes = visible;
  }

  fetchDocFolders() {
    //Add loading state
    this.loadingState.contentControlsLoadingState = true;
    getBucketFileList('document-forms')
      .then(async (data = []) => {
        // Collect docTypes from prefixes
        const docTypes = (data || [])
          .filter((file) => file && file.prefix != null)
          .map((file) => {
            return file.prefix.replace('/', '');
          });

        // Build a tabIndex map by inspecting each folder's request JSON
        const metaList = await Promise.all(
          docTypes.map(async (dt) => {
            try {
              const list = await getBucketFileList('document-forms', dt);
              const jsonFiles = (list || []).filter(
                (it) => it?.name && it.name.toLowerCase().endsWith('.json')
              );
              const norm = (s) => (s || '').toLowerCase().replace(/[\s_-]/g, '');
              const dtNorm = norm(dt);
              const pick =
                jsonFiles.find((f) => f.name.toLowerCase().includes('-request.json')) ||
                jsonFiles.find((f) => {
                  const base = (f.name.split('/').pop() || '').replace(/\.json$/i, '');
                  return norm(base) === dtNorm;
                }) ||
                jsonFiles[0];

              let tabIndex = Number.POSITIVE_INFINITY;
              let isDebug = false;
              if (pick && pick.name && pick.name.includes('/')) {
                const [folderName, fileName] = pick.name.split('/');
                try {
                  const reqJson = await getJSONContentFromFile('document-forms', folderName, fileName);
                  if (reqJson && typeof reqJson.tabIndex === 'number') {
                    tabIndex = reqJson.tabIndex;
                  }
                  if (reqJson && reqJson.isDebug === true) {
                    isDebug = true;
                  }
                  // eslint-disable-next-line no-unused-vars
                } catch (e) {
                  /* empty */
                }
              }
              return { docType: dt, tabIndex, isDebug };
              // eslint-disable-next-line no-unused-vars
            } catch (e) {
              return { docType: dt, tabIndex: Number.POSITIVE_INFINITY, isDebug: false };
            }
          })
        );

        // Map meta and recompute filtered documentTypes by tabIndex (and hide debug by default)
        this.docTypeMeta = this.docTypeMeta || {};
        metaList.forEach((m) => (this.docTypeMeta[m.docType] = m));
        this.recomputeDocumentTypes();
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
    if (azureDevopsUrl && azureDevopsPat) {
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
      this.fetchWorkItemTypeList();
    }
    if (!teamProjectId) {
      this.workItemTypes = [];
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
    }

    // Return the template list after all processing is complete
    return this.templateList;
  }

  //for fetching all the collections links
  fetchCollectionLinkTypes() {
    this.azureRestClient.getCollectionLinkTypes().then((data) => {
      this.linkTypes = data || [];
    });
  }

  // Validate credentials without mutating global store credentials.
  // Returns { ok: true, name, userId } on success; otherwise { ok: false, status, message }.
  async testCredentials(url, pat) {
    try {
      const normalizedUrl = (url || '').endsWith('/') ? url : `${url || ''}/`;
      const tempClient = new RestApi(normalizedUrl, pat);
      const data = await tempClient.getUserDetails();
      // Some servers may redirect to an HTML sign-in page; detect that early
      if (typeof data === 'string' && /(<!DOCTYPE|<html\b)/i.test(data)) {
        // Treat as an auth redirect; bubble up a synthetic 302 to map a clearer message
        const err = new Error('Received sign-in HTML instead of JSON (likely auth redirect).');
        err.status = 302;
        throw err;
      }
      if (data?.identity) {
        const { DisplayName: name, TeamFoundationId: userId } = data.identity;
        return { ok: true, name, userId };
      }
      return { ok: false, status: 0, message: 'Unknown authentication response' };
    } catch (err) {
      const status =
        err?.status || err?.response?.status || (/401/.test(`${err?.message}`) ? 401 : undefined);
      logger.error(
        `Error occurred while fetching user details${status ? ` (${status})` : ''}: ${err?.message}`
      );
      let message = 'Authentication failed';
      const raw = `${err?.message || ''}`;
      const isNetworkErr = /(Network\s?Error|Failed to fetch|NetworkError)/i.test(raw);
      const u = (url || '').toLowerCase();
      const looksLikeAzdoOrTfs = /dev\.azure\.com|visualstudio\.com|\/tfs/i.test(u);
      if (status === 401) {
        message = 'Unauthorized (401). Your PAT is invalid or expired.';
      } else if (status === 403) {
        message = 'Forbidden (403). Your PAT may not have the required scopes.';
      } else if (typeof status === 'number' && status >= 300 && status < 400) {
        // Many ADO/TFS setups redirect unauthenticated users (e.g., to a sign-in page)
        // Treat this as an auth failure to give a clearer hint
        message = `Redirect (${status}). The server redirected to a sign-in page, which usually indicates invalid credentials or a policy requiring interactive login. Use a valid PAT and ensure the org allows non-interactive access.`;
      } else if (!status && isNetworkErr) {
        // Heuristic: when calling ADO/TFS from the browser with invalid creds, CORS blocks the 401 body
        if (pat?.trim() && looksLikeAzdoOrTfs) {
          message = `Likely unauthorized (401), but the browser blocked the response due to CORS. Verify your PAT, required scopes, organization URL, or network/VPN.`;
        } else {
          message = `Network error. Could not reach ${url}. Check the organization URL and your network/VPN.`;
        }
      } else if (raw) {
        message = raw;
      }
      logger.error(`Auth validation failed${status ? ` (${status})` : ''}: ${message}`);
      return { ok: false, status, message };
    }
  }

  // Attempts to fetch and cache user details for current store credentials.
  // Returns true on success, false on failure. On failure, sets lastAuthErrorStatus (e.g., 401).
  async fetchUserDetails() {
    try {
      const data = await this.azureRestClient.getUserDetails();
      if (data?.identity) {
        const { DisplayName: name, TeamFoundationId: userId } = data.identity;
        logger.debug(`User details: ${name} - ${userId}`);
        this.userDetails = { name, userId };
        this.isAuthenticated = true;
        this.lastAuthErrorStatus = null;
        return true;
      }
      this.isAuthenticated = false;
      this.lastAuthErrorStatus = null;
      return false;
    } catch (err) {
      const status =
        err?.status || err?.response?.status || (/401/.test(`${err?.message}`) ? 401 : undefined);
      this.isAuthenticated = false;
      this.lastAuthErrorStatus = status ?? null;
      logger.error(
        `Error occurred while fetching user details${status ? ` (${status})` : ''}: ${err?.message}`
      );
      logger.error('Error stack:');
      logger.error(err?.stack);
      // Proactively emit unauthorized when we can infer it (covers CORS-masked 401s after PAT revoke)
      try {
        const raw = `${err?.message || ''}`;
        const isNetworkErr = /(Network\s?Error|Failed to fetch|NetworkError|ERR_FAILED)/i.test(raw);
        const urlFromCookies = sanitizeCookie(cookies.getItem('azureDevopsUrl')).toLowerCase();
        const patFromCookies = sanitizeCookie(cookies.getItem('azureDevopsPat'));
        const looksLikeAzdoOrTfs = /dev\.azure\.com|visualstudio\.com|\/tfs/i.test(urlFromCookies);
        if (
          status === 401 ||
          status === 302 ||
          (!status && isNetworkErr && looksLikeAzdoOrTfs && patFromCookies)
        ) {
          // Dispatch global event; App/MainTabs listeners will clear cookies and show login
          window.dispatchEvent(new CustomEvent('auth-unauthorized'));
        }
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        /* empty */
      }
      return false;
    }
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

  // Set or update validation state for a specific content control and key (e.g., 'baseType', 'gitRange')
  setValidationState(index, key, state) {
    const idx = String(index);
    const current = this.validationStates || {};
    const prev = current[idx] || {};
    const nextIndexState = {
      ...prev,
      [String(key)]: {
        isValid: !!state?.isValid,
        message: state?.message || '',
      },
    };
    this.validationStates = {
      ...current,
      [idx]: nextIndexState,
    };
  }

  // Clear validation for an index; if key provided, clear only that key, else clear entire index
  clearValidationForIndex(index, key) {
    const idx = String(index);
    const current = this.validationStates || {};
    if (key && current[idx]) {
      const newIndexState = { ...current[idx] };
      delete newIndexState[String(key)];
      const { [idx]: _, ...rest } = current;
      const next = Object.keys(newIndexState).length > 0 ? { ...rest, [idx]: newIndexState } : { ...rest };
      this.validationStates = next;
    } else if (current[idx]) {
      const { [idx]: _, ...rest } = current;
      this.validationStates = { ...rest };
    }
  }

  //for fetching shared queries
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
  fetchGitRepoBranches(RepoId) {
    this.loadingState.gitBranchLoadingState = true;
    this.azureRestClient
      .getGitRepoBranches(RepoId, this.teamProject)
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

  fetchWorkItemTypeList() {
    if (!this.teamProject) {
      this.workItemTypes = [];
      return;
    }

    this.loadingState.workItemTypesLoadingState = true;
    this.azureRestClient
      .getWorkItemTypeList(this.teamProject)
      .then((data) => {
        const types = Array.isArray(data?.value) ? data.value : Array.isArray(data) ? data : [];
        this.workItemTypes = types
          .filter((type) => type && type.name)
          .map((type) => ({
            name: type.name,
            color: type.color,
            icon: type.icon,
            states: Array.isArray(type.states)
              ? type.states.map((state) => ({
                  name: state?.name,
                  color: state?.color,
                  category: state?.category,
                }))
              : [],
          }));
      })
      .catch((err) => {
        logger.error(`Error occurred while fetching work item types: ${err.message}`);
        logger.error('Error stack:');
        logger.error(err.stack);
        this.workItemTypes = [];
      })
      .finally(() => {
        this.loadingState.workItemTypesLoadingState = false;
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

  //setting the testPlans array
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
      return await this.azureRestClient.GetRepoReferences(selectedRepo, this.teamProject, gitObjectType);
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
    //adding link types filters to content control
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
    await createIfBucketDoesNotExist(this.ProjectBucketName);
    let docReq = this.requestJson;
    return sendDocumentToGenerator(docReq);
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
    // Use replace with regex for Edge 92 compatibility (replaceAll not supported)
    const fixedUrl = attachmentWikiUrl?.replace(/ /g, '%20') || undefined;
    this.attachmentWikiUrl = fixedUrl;
  }

  async uploadFile(file, bucketName) {
    const formData = new FormData();
    await createIfBucketDoesNotExist(bucketName);
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
        .replace(/\.do[ct]x?$/i, '') || 'template';
    const tempFileName = this.isCustomTemplate
      ? `${templateName}-${this.getFormattedDate()}`
      : this.contextName
      ? `${this.teamProjectName}-${this.docType}-${this.contextName}-${this.getFormattedDate()}`
      : `${this.teamProjectName}-${this.docType}-${this.getFormattedDate()}`;
    return {
      tfsCollectionUri: azureDevopsUrl,
      PAT: azureDevopsPat,
      teamProjectName: this.teamProjectName,
      // For flows like Test-Reporter (Excel), there may be no selected template.
      // Avoid accessing .url on null and let the API handle an empty template when appropriate.
      templateFile: this.selectedTemplate?.url || '',
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
