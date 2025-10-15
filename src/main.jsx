import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "@radix-ui/themes/styles.css";
import './i18n'; // import i18n config
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

/* ------------------------ fonts ----------------------- */
// inter
import "@fontsource/inter/100.css";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
// space mono
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import ZenshinProvider from "./utils/ContextProvider.jsx";
import { AuthProvider } from './contexts/AuthContext.jsx';


/* ------------------------------------------------------ */


ReactDOM.createRoot(document.getElementById("root")).render(
  <I18nextProvider i18n={i18n}>
    <AuthProvider>
      <ZenshinProvider>
        <App />
      </ZenshinProvider>
    </AuthProvider>
  </I18nextProvider>,
);
