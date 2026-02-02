// const buildTimeUrl = (import.meta.env && import.meta.env.VITE_DOCGEN_API_URL) || '';
// const jsonDocument_url =
//   buildTimeUrl ||
//   (window.location.hostname !== 'localhost'
//     ? `http://${window.location.hostname}:30001`
//     : 'http://localhost:30001');

// let C = {
//   jsonDocument_url,
// };

// export default C;

const jsonDocument_url = window.APP_CONFIG?.JSON_DOCUMENT_URL ?? '';

if (!jsonDocument_url) {
  throw new Error('JSON_DOCUMENT_URL is not defined in APP_CONFIG');
}

let C = {
  jsonDocument_url,
};

export default C;
