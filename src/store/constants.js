let jsonDocument_url =
  window.location.hostname !== "localhost"
    ? `http://${window.location.hostname}:30001`
    : "http://localhost:30001";

let C = {
  jsonDocument_url,
};

export default C;
