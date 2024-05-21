import React from "react";
import MainTabs from "./components/tabs/MainTabs";
import SettingsPage from "./components/settings/SettingPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useCookies } from "react-cookie";

function App({ store }) {
  const [cookies, setCookie] = useCookies(["azuredevopsUrl", "azuredevopsPat"]);

  const login = (selectedUrl, selectedPat) => {
    let d = new Date();
    d.setTime(d.getTime() + (525960*60*1000));
    setCookie("azuredevopsUrl", selectedUrl, { path: '/' , expires: d});
    setCookie("azuredevopsPat", selectedPat, { path: '/' , expires: d});
    window.location.reload(); // Reload the page after signing in

  };

  return (
    <div className="App">
      <ToastContainer />
      {cookies.azuredevopsUrl && cookies.azuredevopsPat ? (
        <MainTabs store={store} />
      ) : (
        <SettingsPage login={login.bind(this)} />
      )}
    </div>
  );
}

export default App;
