import axios from 'axios';
import C from '../constants';
import { v4 as uuidv4 } from 'uuid';

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
  projectName = null
) => {
  let url;
  try {
    url =
      docType !== null
        ? `${C.jsonDocument_url}/minio/bucketFileList/${bucketName}?docType=${docType}&isExternalUrl=${isExternalUrl}`
        : `${C.jsonDocument_url}/minio/bucketFileList/${bucketName}?isExternalUrl=${isExternalUrl}`;
    const urlToSend = projectName === null ? url : `${url}&projectName=${projectName}`;
    let res = await makeRequest(urlToSend, undefined, undefined, headers);
    return res.bucketFileList;
  } catch (e) {}
};

export const getJSONContentFromFile = async (bucketName, folderName, fileName) => {
  let url;
  try {
    url = `${C.jsonDocument_url}/minio/ContentFromFile/${bucketName}/${folderName}/${fileName}`;
    let res = await makeRequest(url, undefined, undefined, headers);
    return res.contentFromFile;
  } catch (e) {}
};

export const createIfBucketDoesentExsist = async (bucketName) => {
  let url;
  let data = { bucketName };
  try {
    url = `${C.jsonDocument_url}/minio/createBucket`;
    return await makeRequest(url, 'post', data, headers);
  } catch (e) {}
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
    console.log(`error making request to the api`);
    console.log(e);
    console.log(JSON.stringify(e.data));
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
    return [];
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
    throw err;
  }
};
