import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import App from "./App";
import "./styles.css";
import "./auth.css";
import "./admin-users.css";
import "./admin-questions.css";
import "./lemiex-chat.css";
import "./lemiex-chat-ux.css";
import "./workshop-dashboard.css";
import "./knowledge-hub.css";
import "./ceo-chat.css";
import "./feline-editorial.css";
import "./ai-office.css";
import "./ai-office-loader.css";
import "./tiktok-dashboard.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
