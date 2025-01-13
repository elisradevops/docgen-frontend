import axios from 'axios';
import C from '../constants';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
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

export const createIfBucketDoesentExsist = async (bucketName) => {
  let url;
  let data = { bucketName };
  try {
    url = `${C.jsonDocument_url}/minio/createBucket`;
    return await makeRequest(url, 'post', data, headers);
  } catch (e) {
    logger.error(`Cannot create bucket ${bucketName}: ${e.message}`);
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

export const sendDocumentTogenerator = async (docJson) => {
  try {
    docJson.documentId = uuidv4();
    let res = await axios.post(`${C.jsonDocument_url}/jsonDocument/create`, docJson, headers);
    window.currentdoc = docJson.documentId;
    return res.data;
  } catch (err) {
    if (err.response) {
      // If the error has a response, it comes from the server
      logger.error('Error response while sending document to generator:', err.response.data);
      throw new Error(err.response.data.error);
    } else {
      // Something else happened during the request setup
      logger.error(`Error while sending document to generator: ${JSON.stringify(err.message)}`);
      throw new Error(err.message);
    }
  }
};

export const uploadTemplateToStorage = async (formData) => {
  try {
    // Iterate through formData to check if the file was appended correctly
    return await axios.post(`${C.jsonDocument_url}/minio/templates/uploadTemplate`, formData, {
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
