/**
 * Wait until test suites finish loading or a timeout elapses.
 * @param {import('../store/DataStore').default} store MobX store
 * @param {number} [timeoutMs=10000] Maximum wait duration in ms
 * @returns {Promise<void>} Resolves when loading flag is false or timeout reached
 */
export async function waitForSuites(store, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (store?.loadingState?.testSuiteListLoading) {
    if (Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Compute recursive suite id collection including descendants.
 * @param {Array<{id:number}>} selectedSuites Non-recursive suites selected by user
 * @param {import('../store/DataStore').default} store MobX store
 * @returns {{ testSuiteArray:number[], nonRecursiveTestSuiteIdList:number[] }}
 */
export function suiteIdCollection(selectedSuites = [], store) {
  const nonRecursiveTestSuiteIdList = Array.isArray(selectedSuites)
    ? selectedSuites.map((s) => s?.id).filter((v) => v != null)
    : [];
  const testSuiteArray = [];
  const allSuites = Array.isArray(store?.testSuiteList) ? store.testSuiteList : [];
  const byParent = new Map();
  for (const s of allSuites) {
    const list = byParent.get(s.parent) || [];
    list.push(s);
    byParent.set(s.parent, list);
  }
  const addDescendants = (suiteId) => {
    if (testSuiteArray.includes(suiteId)) return;
    testSuiteArray.push(suiteId);
    const children = byParent.get(suiteId) || [];
    for (const child of children) addDescendants(child.id);
  };
  for (const id of nonRecursiveTestSuiteIdList) addDescendants(id);
  return { testSuiteArray, nonRecursiveTestSuiteIdList };
}

/**
 * Validate a saved query against a tree and apply via setter; clears invalid selections.
 * @param {any} savedQuery Previously saved query object
 * @param {any} tree Root tree node to validate against
 * @param {(q:any)=>void} setter State setter for the query
 * @param {(trees:any[], q:any)=>any} validateQueryFn Validator that returns a valid node or falsy
 */
export function validateAndApplyQuery(savedQuery, tree, setter, validateQueryFn) {
  if (!setter) return;
  if (!savedQuery || !tree || !validateQueryFn) {
    setter(null);
    return;
  }
  const valid = validateQueryFn([tree], savedQuery);
  setter(valid || null);
}

/**
 * Apply a saved test plan selection then (after suites load) map saved suite ids back to options.
 * @param {Object} params
 * @param {any} params.saved Saved data blob
 * @param {import('../store/DataStore').default} params.store MobX store
 * @param {(value:{key:number,text:string})=>Promise<void>} params.handleTestPlanChanged Async handler to set plan and load suites
 * @param {()=>Promise<void>} params.waitForSuitesFn Optional waiter for suites loading
 * @returns {Promise<Array<any>>} Array of suite option objects suitable for UI selection
 */
export async function applyPlanThenSuites({ saved, store, handleTestPlanChanged, waitForSuitesFn }) {
  const id = saved?.testPlanId;
  if (!id) return [];
  const plan = (store?.testPlansList || []).find((p) => p.id === id);
  if (!plan) return [];
  await handleTestPlanChanged({ key: id, text: plan.name });
  if (typeof waitForSuitesFn === 'function') {
    await waitForSuitesFn();
  }
  const src = Array.isArray(saved?.nonRecursiveTestSuiteIdList)
    ? saved.nonRecursiveTestSuiteIdList
    : Array.isArray(saved?.testSuiteArray)
    ? saved.testSuiteArray
    : [];
  const list = (store?.getTestSuiteList || store?.testSuiteList || []) || [];
  const options = src
    .map((suiteId) => list.find((suite) => suite.id === suiteId))
    .filter(Boolean)
    .map((s) => ({ ...s, key: s.id, text: `${s.name} - (${s.id})` }));
  const dedup = new Map(options.map((s) => [s.id, s]));
  return Array.from(dedup.values());
}
