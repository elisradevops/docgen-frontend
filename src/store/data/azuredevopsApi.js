import axios from "axios";
import AzureRestApi from "azuredevops-api";
import C from "../constants";

export const getSharedQueries = async (collectionName, projectName) => {
  let result;
  try {
    result = await GetSharedQueries(projectName);
  } catch (error) {
    console.log(`Error connecting to AzureDevops:
      ${JSON.stringify(error)} `);
    console.log(error);
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
    console.log(`No shared queries to parse`);
    return [];
  }
}
const GetSharedQueries = async (project, path) => {
  let url;
  let queriesList = [];
  try {
    if (path === undefined)
      url =
        C.tfs_collection_url +
        project +
        "/_apis/wit/queries/Shared%20Queries?$depth=1";
    else
      url =
        C.tfs_collection_url +
        project +
        "/_apis/wit/queries/" +
        path +
        "?$depth=1";

    let queries = await getItemContent(url, C.PAT);
    for (let i = 0; i < queries.children.length; i++)
      if (queries.children[i].isFolder) {
        queriesList.push(queries.children[i]);
        await GetSharedQueries(project, queries.children[i].path);
      } else {
        queriesList.push(queries.children[i]);
      }
    return await GetModeledQuery(queriesList);
  } catch (e) {}
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

const getItemContent = async (
  url,
  pat,
  requestMethod = "get",
  data = {},
  customHeaders = {}
) => {
  let config = {
    headers: customHeaders,
    method: requestMethod,
    auth: {
      username: "",
      password: pat,
    },
    data: data,
  };
  let json;
  try {
    let result = await axios(url, config);
    json = JSON.parse(JSON.stringify(result.data));
  } catch (e) {
    console.log(`error making request to azure devops`);
    console.log(e);
    console.log(JSON.stringify(e.data));
  }
  return json;
};

export const getTeamProjectTestPlans = async (teamProjectName) => {
  let azureRestApi = new AzureRestApi(C.tfs_collection_url, C.PAT);
  let testPlanList = await azureRestApi.GetTestPlans(teamProjectName);
  try {
    return testPlanList.value;
  } catch (e) {
    console.warn(
      `no test-plans found - this could mean azure devops connection problems`
    );
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
          link.text != "Shared Steps" &&
          link.text != "Duplicate" &&
          link.text != "Hyperlink" &&
          link.text != "Artifact Link" &&
          link.text != "Attached File" &&
          link.text != "Duplicate Of" &&
          link.text != "Test Case"
        );
      });
    return linkData;
  } catch (e) {
    console.warn(
      `no linkTypes found - this could mean azure devops connection problems`
    );
    return [];
  }
};
