export const validateQuery = (queryData, query) => {
  if (!queryData || !query) return null;

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

  // Try to find the query in the tree data
  const foundQuery = findNodeById(queryData, query.id);

  // Return the found query if valid, otherwise null
  return foundQuery && foundQuery.isValidQuery ? query : null;
};
