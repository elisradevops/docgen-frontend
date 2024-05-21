import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { CookiesProvider } from "react-cookie";

import Store from "./store/DataStore";
window.process = {};

ReactDOM.render(
  <CookiesProvider>
    <App store={Store} />{" "}
  </CookiesProvider>,
  document.getElementById("root")
);
