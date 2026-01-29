const buildTimeUrl = (import.meta.env && import.meta.env.VITE_DOCGEN_API_URL) || '';
const jsonDocument_url =
  buildTimeUrl ||
  (window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:30001`
    : 'http://localhost:30001');

let C = {
  jsonDocument_url,
};

export default C;
