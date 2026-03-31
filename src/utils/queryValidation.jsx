export const validateQuery = (queryData, query) => {
  if (!queryData || !query) return null;

  const toCandidateIds = (value) => {
    if (value == null) return [];
    if (typeof value !== 'object') return [String(value)];
    const candidates = [value.id, value.value, value.key]
      .map((candidate) => String(candidate || '').trim())
      .filter((candidate) => candidate !== '');
    return Array.from(new Set(candidates));
  };

  // Function to search for a node in the tree by ID
  const findNodeById = (treeData, id) => {
    for (const node of treeData) {
      if (node.id === id) return node;
      if (node.children?.length > 0) {
        const foundInChildren = findNodeById(node.children, id);
        if (foundInChildren) return foundInChildren;
      }
    }
    return null;
  };

  const queryIds = toCandidateIds(query);
  const foundQuery = queryIds.map((id) => findNodeById(queryData, id)).find(Boolean);

  // Return the found query if valid, otherwise null
  return foundQuery && foundQuery.isValidQuery ? foundQuery : null;
};
