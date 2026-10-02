import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { connect } from "./net.js";
import { store } from "./store.js";
import { useStore } from "./useStore.js";
import { introSeen } from "./shell/firstRun.js";
import { Boot } from "./ui/Boot.js";
import { Create } from "./ui/Create.js";
import { Register } from "./ui/Register.js";
import { Slides } from "./ui/Slides.js";
import { World } from "./ui/World.js";
import { statusKey } from "./i18n/index.js";

function App() {
  const state = useStore();
  // Слайды вступления: только первый запуск на устройстве, и только до входа.
  const [introDone, setIntroDone] = useState(() => introSeen());
  // До входа два окна: вход и регистрация аккаунта. Персонаж заводится после.
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");

  useEffect(() => {
    connect();
  }, []);

  if (!state.auth && !introDone) {
    return <Slides lang={state.lang} onDone={() => setIntroDone(true)} />;
  }

  if (!state.auth) {
    if (authScreen === "register") {
      return <Register lang={state.lang} onLogin={() => setAuthScreen("login")} />;
    }
    return (
      <Boot
        lang={state.lang}
        statusKey={statusKey(state.status)}
        onRegister={() => setAuthScreen("register")}
      />
    );
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
