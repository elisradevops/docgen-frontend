export const buildServiceVersionsText = (services = [], frontendVersion = '') => {
  const getVersion = (key) => {
    const service = services.find((candidate) => candidate?.key === key);
    return String(service?.version || 'unknown');
  };
  const contentControl = services.find((service) => service?.key === 'content-control');

  return [
    `DocGen Frontend: v${String(frontendVersion || 'unknown')}`,
    `API Gate Version: ${getVersion('api-gate')}`,
    `Content Control version: ${getVersion('content-control')}`,
    `JSON to Word Version: ${getVersion('json-to-word')}`,
    `Data Provider: ${String(contentControl?.packages?.dataProvider?.version || 'unknown')}`,
    `DG Skins: ${String(contentControl?.packages?.dgSkinsPackage?.version || 'unknown')}`,
  ].join('\n');
};
