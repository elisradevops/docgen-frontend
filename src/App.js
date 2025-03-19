import React from 'react';
import MainTabs from './components/tabs/MainTabs';
import SettingsPage from './components/settings/SettingPage';
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useCookies } from 'react-cookie';

function App({ store }) {
  const [cookies, setCookie] = useCookies(['azuredevopsUrl', 'azuredevopsPat']);

  const login = (selectedUrl, selectedPat) => {
    let d = new Date();
    d.setTime(d.getTime() + 525960 * 60 * 1000);
    // Set the cookies for the selected URL and PAT
    setCookie('azuredevopsUrl', selectedUrl.endsWith('/') ? selectedUrl : selectedUrl.concat('/'), {
      path: '/',
      expires: d,
    });
    setCookie('azuredevopsPat', selectedPat, { path: '/', expires: d });
    store.fetchUserDetails();
    window.location.reload(); // Reload the page after signing in
  };

  return (
    <div className='App'>
      <ToastContainer
        position='top-center'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        draggable
        pauseOnHover
        transition={Slide}
        style={{
          whiteSpace: 'nowrap',
          width: 'auto',
          maxWidth: '90vw',
          padding: '10px',
        }} // Inline styles applied to all toasts
      />
      {cookies.azuredevopsUrl && cookies.azuredevopsPat ? (
        <MainTabs store={store} />
      ) : (
        <SettingsPage login={login.bind(this)} />
      )}
    </div>
  );
}

export default App;
