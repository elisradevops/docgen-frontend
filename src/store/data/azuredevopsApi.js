import axios from 'axios';
import AzureRestApi from 'azuredevops-api';
import C from '../constants';
import logger from '../../utils/logger';

export const getSharedQueries = async (collectionName, projectName) => {
  let result;
  try {
    result = await GetSharedQueries(projectName);
  } catch (error) {
    logger.error(`Error while getting shared queries: ${error.message}`);
    logger.error('Error Stack:');
    logger.error(error.stack);
    return [];
  }
  let parsedResults = await sharedQueriesParser(result);
  return parsedResults;
};

async function sharedQueriesParser(sharedQueries = null) {
  let sharedQueriesArray = [];
  if (sharedQueries) {
    await Promise.all(
      sharedQueries.map(async (query) => {
        sharedQueriesArray.push({
          name: query.queryName,
          queryId: query.id,
          isFolder: query.isFolder,
        });
        if (query.isFolder) {
          await Promise.all(
            query.childern.map((subquery) => {
              sharedQueriesArray.push({
                name: subquery.queryName,
                queryId: subquery.id,
                isFolder: subquery.isFolder,
              });
            })
          );
        }
      })
    );
    return sharedQueriesArray;
  } else {
    const msg = `No shared queries to parse`;
    logger.error(msg);
    return [];
  }
}
const GetSharedQueries = async (project, path) => {
  let url;
  let queriesList = [];
  try {
    if (path === undefined)
      url = C.tfs_collection_url + project + '/_apis/wit/queries/Shared%20Queries?$depth=1';
    else url = C.tfs_collection_url + project + '/_apis/wit/queries/' + path + '?$depth=1';

    let queries = await getItemContent(url, C.PAT);
    for (let i = 0; i < queries.children.length; i++)
      if (queries.children[i].isFolder) {
        queriesList.push(queries.children[i]);
        await GetSharedQueries(project, queries.children[i].path);
      } else {
        queriesList.push(queries.children[i]);
      }
    return await GetModeledQuery(queriesList);
  } catch (e) {
    logger.error(`could not fetch shared queries: ${e.message}`);
    logger.error('Error stack:');
    logger.error(e.stack);
  }
};
// get queris structured
const GetModeledQuery = async (list) => {
  let queryListObject = [];
  list.forEach((query) => {
    let newObj = {
      queryName: query.name,
      wiql: query._links.wiql != null ? query._links.wiql : null,
      id: query.id,
    };
    queryListObject.push(newObj);
  });
  return queryListObject;
};

const getItemContent = async (url, pat, requestMethod = 'get', data = {}, customHeaders = {}) => {
  let config = {
    headers: customHeaders,
    method: requestMethod,
    auth: {
      username: '',
      password: pat,
    },
    data: data,
  };
  let json;
  try {
    let result = await axios(url, config);
    json = JSON.parse(JSON.stringify(result.data));
  } catch (e) {
    logger.error(`could not fetch item from ${url}: ${e.message}`);
    logger.error(`Error data: ${e.data}`);
  }
  return json;
};

export const getTeamProjectTestPlans = async (teamProjectName) => {
  let azureRestApi = new AzureRestApi(C.tfs_collection_url, C.PAT);
  let testPlanList = await azureRestApi.GetTestPlans(teamProjectName);
  try {
    return testPlanList.value;
  } catch (e) {
    logger.warn(`could not get Team project test plans ${e.message}`);
    return [];
  }
};

export const getCollectionLinkTypes = async () => {
  try {
    let azureRestApi = new AzureRestApi(C.tfs_collection_url, C.PAT);
    let linkTypes = await azureRestApi.GetCllectionLinkTypes();
    let linkData = await linkTypes.value
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
    return linkData;
  } catch (e) {
    logger.warn(`could not get collection link types ${e.message}`);
    return [];
  }
};
