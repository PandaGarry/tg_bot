import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { connect } from "./net.js";
import { store } from "./store.js";
import { useStore } from "./useStore.js";
import { Boot } from "./ui/Boot.js";
import { Create } from "./ui/Create.js";
import { World } from "./ui/World.js";
import { statusKey } from "./i18n/index.js";

function App() {
  const state = useStore();

  useEffect(() => {
    connect();
  }, []);

  if (!state.auth) {
    return <Boot lang={state.lang} statusKey={statusKey(state.status)} />;
  }

  const view = state.view;
  if (state.auth.needsLord || !view?.me) {
    return <Create lang={state.lang} view={view} serverNow={state.view?.world.now ?? state.clockOffset + Date.now()} />;
  }

  return <World view={view} lang={state.lang} serverNow={state.view?.world.now ?? state.clockOffset + Date.now()} />;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
