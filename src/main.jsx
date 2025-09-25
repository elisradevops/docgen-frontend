import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { CookiesProvider } from 'react-cookie';

import Store from './store/DataStore.jsx';
import AppThemeProvider from './theme/AppThemeProvider.jsx';

window.process = {};
createRoot(document.getElementById('root')).render(
  <CookiesProvider>
    <AppThemeProvider>
      <App store={Store} />
    </AppThemeProvider>
  </CookiesProvider>
);
