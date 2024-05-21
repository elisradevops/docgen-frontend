import axios from "axios";
import C from "../constants";
import { v4 as uuidv4 } from "uuid";

var Minio = require("minio");

const headers = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
};

export const getBucketFileList = async (bucketName,isExternalUrl = false) => {
  let url;
  try {
    url = `${C.jsonDocument_url}/minio/bucketFileList/${bucketName}?isExternalUrl=${isExternalUrl}`;
    let res = await makeRequest(url, undefined,undefined,headers);
    return res.bucketFileList;
  } catch (e) {}
};

export const getJSONContentFromFile = async (bucketName, fileName) => {
  let url;
  try {
    url = `${C.jsonDocument_url}/minio/ContentFromFile/${bucketName}/${fileName}`;
    let res = await makeRequest(url, undefined,undefined,headers);
    return res.contentFromFile;
  } catch (e) {}
};

export const createIfBucketDoesentExsist = async (bucketName) => {
  let url;
  let data = { bucketName };
  try {
    url = `${C.jsonDocument_url}/minio/createBucket`;
    return await makeRequest(url, "post", data, headers);
  } catch (e) {}
};

const makeRequest = async (
  url,
  requestMethod = "get",
  data = {},
  customHeaders = {}
) => {
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
    let res = await axios.post(
      `${C.jsonDocument_url}/jsonDocument/create`,
      docJson,
      headers
    );
    window.currentdoc = docJson.documentId;
    return res.data;
  } catch (err) {
    return [];
  }
}; 
