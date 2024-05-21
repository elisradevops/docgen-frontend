const proxy = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    proxy("/jsonDocument", {
      target: "http://10.180.0.127:3000/",
    })
  );
  app.use(proxy("/minio", { target: "http://localhost:4000/" }));
};
