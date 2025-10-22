import axios from 'axios';
import C from '../constants';
import { v4 as uuidV4 } from 'uuid';
import logger from '../../utils/logger';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const headers = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
};

export const getBucketFileList = async (
  bucketName,
  docType = null,
  isExternalUrl = false,
  projectName = null,
  recurse = false
) => {
  let url;
  try {
    url =
      docType !== null
        ? `${C.jsonDocument_url}/minio/bucketFileList/${bucketName}?docType=${docType}&isExternalUrl=${isExternalUrl}&recurse=${recurse}`
        : `${C.jsonDocument_url}/minio/bucketFileList/${bucketName}?isExternalUrl=${isExternalUrl}&recurse=${recurse}`;
    const urlToSend = projectName === null ? url : `${url}&projectName=${projectName}`;
    let res = await makeRequest(urlToSend, undefined, undefined, headers);
    return res.bucketFileList;
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error(`Error Response ${JSON.stringify(err.response.data)}`);
      throw new Error(err.response.data.message);
    } else if (err.code === 'ECONNABORTED') {
      logger.error(`Request timeout while getting bucket file list`);
      throw new Error('Request timeout - server took too long to respond');
    } else if (err.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error(
        'Network error: Unable to connect to server. Please check your internet connection and try again.'
      );
    } else {
      // Something else happened during the request setup
      logger.error(`Error while getting bucket file list: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

export const getJSONContentFromFile = async (bucketName, folderName, fileName) => {
  let url;
  try {
    url = `${C.jsonDocument_url}/minio/ContentFromFile/${bucketName}/${folderName}/${fileName}`;
    let res = await makeRequest(url, undefined, undefined, headers);
    return res.contentFromFile;
  } catch (e) {
    logger.error(`Cannot get Json content for ${bucketName}/${folderName}/${fileName}: ${e.message}`);
  }
};

export const createIfBucketDoesNotExist = async (bucketName) => {
  let url;
  let data = { bucketName };
  try {
    url = `${C.jsonDocument_url}/minio/createBucket`;
    return await makeRequest(url, 'post', data, headers);
  } catch (e) {
    if (e.code === 'ECONNABORTED') {
      logger.error(`Request timeout while creating bucket`);
      throw new Error('Request timeout - server took too long to respond');
    } else if (e.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
    }
    logger.error(`Cannot create bucket ${bucketName}: ${e.message}`);
    throw e;
  }
};

const makeRequest = async (url, requestMethod = 'get', data = {}, customHeaders = {}) => {
  let config = {
    headers: customHeaders,
    method: requestMethod,
    data: data,
  };
  let json;
  try {
    let result = await axios(url, config);
    json = JSON.parse(JSON.stringify(result.data));
  } catch (e) {
    logger.error(`API Request Error for ${url}: ${e.message}`);
    logger.error('Error stack:');
    logger.error(e.stack);
  }
  return json;
};

export const sendDocumentToGenerator = async (docJson) => {
  try {
    docJson.documentId = uuidV4();
    let res = await axios.post(`${C.jsonDocument_url}/jsonDocument/create`, docJson, headers);
    window.currentdoc = docJson.documentId;
    return res.data;
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error('Error response while sending document to generator:', err.response.data);
      throw new Error(err.response.data.error);
    } else if (err.code === 'ECONNABORTED') {
      logger.error('Request timeout while sending document to generator');
      throw new Error('Request timeout - server took too long to respond');
    } else if (err.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error(
        'Network error: Unable to connect to server. Please check your internet connection and try again.'
      );
    } else {
      // Something else happened during the request setup
      logger.error(`Error while sending document to generator: ${JSON.stringify(err.message)}`);
      throw new Error(err.message);
    }
  }
};

/**
 * Gets the list of favorites for a user and document type
 * @param {string} userId - The user ID
 * @param {string} docType - The document type
 * @returns {Promise<Object>} The list of favorites
 */
export const getFavoriteList = async (userId, docType, teamProjectId) => {
  try {
    let res = await axios.get(`${C.jsonDocument_url}/dataBase/getFavorites`, {
      params: { userId, docType, teamProjectId },
      headers,
      timeout: DEFAULT_TIMEOUT,
    });
    return res.data.favorites || [];
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error(`Error response while getting favorite list: ${JSON.stringify(err.response.data)}`);
      throw new Error(err.response.data.error);
    } else if (err.code === 'ECONNABORTED') {
      logger.error('Request timeout while getting favorite list');
      throw new Error('Request timeout - server took too long to respond');
    } else if (err.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error(
        'Network error: Unable to connect to server. Please check your internet connection and try again.'
      );
    } else {
      // Something else happened during the request setup
      logger.error(`Error while getting favorite list: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

/**
 * Creates or updates a favorite
 * @param {string} userId - The user ID
 * @param {string} name - The favorite name
 * @param {string} docType - The document type
 * @param {Object} dataToSave - The data to save
 * @param {string} teamProjectId - project Id
 * @param {boolean} isShared - is the favorite shared
 * @returns {Promise<Object>} The created or updated favorite
 */
export const createFavorite = async (userId, name, docType, dataToSave, teamProjectId, isShared) => {
  try {
    let res = await axios.post(
      `${C.jsonDocument_url}/dataBase/createFavorite`,
      { userId, name, docType, dataToSave, teamProjectId, isShared },
      { headers, timeout: DEFAULT_TIMEOUT }
    );

    return res.data;
  } catch (err) {
    if (err.response) {
      logger.error(`Error response while creating favorite: ${JSON.stringify(err.response.data)}`);
      throw new Error(err.response.data.error || err.response.data.message);
    } else if (err.code === 'ECONNABORTED') {
      logger.error('Request timeout while creating favorite');
      throw new Error('Request timeout - server took too long to respond');
    } else if (err.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error(
        'Network error: Unable to connect to server. Please check your internet connection and try again.'
      );
    } else {
      logger.error(`Error while creating favorite: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

/**
 * Deletes a favorite by ID
 * @param {string} id - The favorite ID
 * @returns {Promise<Object>} The deleted favorite
 */
export const deleteFavoriteFromDb = async (id) => {
  try {
    let res = await axios.delete(`${C.jsonDocument_url}/dataBase/deleteFavorite/${id}`, {
      headers,
      timeout: DEFAULT_TIMEOUT,
    });

    return res.data;
  } catch (err) {
    if (err.response) {
      logger.error(`Error response while deleting favorite: ${JSON.stringify(err.response.data)}`);
      throw new Error(err.response.data.error);
    } else if (err.code === 'ECONNABORTED') {
      logger.error('Request timeout while deleting favorite');
      throw new Error('Request timeout - server took too long to respond');
    } else if (err.code === 'ENOTFOUND') {
      logger.error(`Network error: Unable to connect to server - DNS resolution failed`);
      throw new Error(
        'Network error: Unable to connect to server. Please check your internet connection and try again.'
      );
    } else {
      logger.error(`Error while deleting favorite: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

export const uploadFileToStorage = async (formData) => {
  try {
    // Iterate through formData to check if the file was appended correctly
    return await axios.post(`${C.jsonDocument_url}/minio/files/uploadFile`, formData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error(
        `Error response while uploading template to storage: ${JSON.stringify(err.response.data)}`
      );
      throw new Error(err.response.data.error);
    } else {
      // Something else happened during the request setup
      logger.error(`Error while uploading template to storage: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

export const deleteFile = async (file, projectName, bucketName) => {
  try {
    return await axios.delete(
      `${C.jsonDocument_url}/minio/files/deleteFile/${bucketName}/${projectName}/${file.etag}`,
      headers
    );
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error(`Error response while deleting template file: ${JSON.stringify(err.response.data)}`);
      const errorMessage = err.response.data.error;
      throw new Error(errorMessage);
    } else {
      // Something else happened during the request setup
      logger.error(`Error while deleting file: ${err.message}`);
      throw new Error(err.message);
    }
  }
};

/**
 * SharePoint Integration API Functions
 */

// Note: OAuth is now handled entirely by frontend (SPA flow with PKCE)
// See: src/utils/sharepointOAuth.js
// Backend OAuth endpoints have been removed

/**
 * Tests SharePoint connection
 * Supports both NTLM credentials and OAuth tokens
 */
export const testSharePointConnection = async (siteUrl, library, folder, auth) => {
  try {
    const body = { siteUrl, library, folder };
    // Check if auth is OAuth token or credentials
    if (auth.accessToken) {
      body.oauthToken = auth;
    } else {
      body.credentials = auth;
    }
    
    const res = await axios.post(
      `${C.jsonDocument_url}/sharepoint/test-connection`,
      body,
      { headers, timeout: DEFAULT_TIMEOUT }
    );
    return res.data;
  } catch (err) {
    logger.error(`Error testing SharePoint connection: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Lists template files from SharePoint folder
 * Supports both NTLM credentials and OAuth tokens
 */
export const listSharePointFiles = async (siteUrl, library, folder, auth) => {
  try {
    const body = { siteUrl, library, folder };
    if (auth.accessToken) {
      body.oauthToken = auth;
    } else {
      body.credentials = auth;
    }
    
    const res = await axios.post(
      `${C.jsonDocument_url}/sharepoint/list-files`,
      body,
      { headers, timeout: 30000 } // 30 second timeout for listing files
    );
    return res.data;
  } catch (err) {
    logger.error(`Error listing SharePoint files: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Checks for conflicts with existing MinIO files
 * Supports both NTLM credentials and OAuth tokens
 */
export const checkSharePointConflicts = async (siteUrl, library, folder, auth, bucketName, projectName, docType) => {
  try {
    const body = { siteUrl, library, folder, bucketName, projectName, docType };
    if (auth.accessToken) {
      body.oauthToken = auth;
    } else {
      body.credentials = auth;
    }
    
    const res = await axios.post(
      `${C.jsonDocument_url}/sharepoint/check-conflicts`,
      body,
      { headers, timeout: 60000 } // 60 second timeout
    );
    return res.data;
  } catch (err) {
    logger.error(`Error checking SharePoint conflicts: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Syncs templates from SharePoint to MinIO
 * Supports both NTLM credentials and OAuth tokens
 */
export const syncSharePointTemplates = async (siteUrl, library, folder, auth, bucketName, projectName, docType, skipFiles = []) => {
  try {
    const body = { siteUrl, library, folder, bucketName, projectName, docType, skipFiles };
    if (auth.accessToken) {
      body.oauthToken = auth;
    } else {
      body.credentials = auth;
    }
    
    const res = await axios.post(
      `${C.jsonDocument_url}/sharepoint/sync-templates`,
      body,
      { headers, timeout: 300000 } // 5 minute timeout for sync
    );
    return res.data;
  } catch (err) {
    logger.error(`Error syncing SharePoint templates: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Saves SharePoint configuration
 */
export const saveSharePointConfig = async (userId, projectName, siteUrl, library, folder, displayName) => {
  try {
    const res = await axios.post(
      `${C.jsonDocument_url}/sharepoint/config`,
      { userId, projectName, siteUrl, library, folder, displayName },
      { headers, timeout: DEFAULT_TIMEOUT }
    );
    return res.data;
  } catch (err) {
    logger.error(`Error saving SharePoint config: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Gets SharePoint configuration
 */
export const getSharePointConfig = async (userId, projectName) => {
  try {
    const params = {};
    if (projectName) params.projectName = projectName;
    
    const res = await axios.get(`${C.jsonDocument_url}/sharepoint/config`, {
      params,
      headers: {
        ...headers.headers,
        'X-User-Id': userId || '',
      },
      timeout: DEFAULT_TIMEOUT,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return { success: false, config: null };
    }
    logger.error(`Error getting SharePoint config: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Gets all SharePoint configurations for a user
 */
export const getAllSharePointConfigs = async (userId) => {
  try {
    const res = await axios.get(`${C.jsonDocument_url}/sharepoint/configs/all`, {
      headers: {
        ...headers.headers,
        'X-User-Id': userId || '',
      },
      timeout: DEFAULT_TIMEOUT,
    });
    return res.data;
  } catch (err) {
    logger.error(`Error getting SharePoint configs: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};

/**
 * Deletes SharePoint configuration for a project
 */
export const deleteSharePointConfig = async (userId, projectName) => {
  try {
    const res = await axios.delete(`${C.jsonDocument_url}/sharepoint/config`, {
      params: { projectName },
      headers: {
        ...headers.headers,
        'X-User-Id': userId || '',
      },
      timeout: DEFAULT_TIMEOUT,
    });
    return res.data;
  } catch (err) {
    logger.error(`Error deleting SharePoint config: ${err.message}`);
    throw new Error(err.response?.data?.message || err.message);
  }
};
