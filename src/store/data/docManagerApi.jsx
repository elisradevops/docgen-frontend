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
