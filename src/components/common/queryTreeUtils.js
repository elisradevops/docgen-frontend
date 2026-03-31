export const resolveSelectedQueryValue = (query) => {
  if (query == null) return undefined;
  if (typeof query === 'object') {
    return query.value ?? query.id ?? query.key ?? undefined;
  }
  return query;
};
