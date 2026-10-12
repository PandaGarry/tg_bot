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
import { Preview } from "./ui/Preview.js";
import { Loading } from "./ui/Loading.js";
import { World } from "./ui/World.js";
import { initializeUiMockup } from "./ui/mockups.js";
import { statusKey } from "./i18n/index.js";
import { gameApp } from "./game/core/application.js";
import { mountCourtScene } from "./game/court/courtScene.js";

// Восстанавливает только локальный CSS-вариант, чтобы его было видно на экранах входа и создания лорда.
initializeUiMockup();

/**
 * Порядок экранов: первый запуск — превью → загрузка → вход/регистрация → создание лорда → двор.
 * Повторный вход — загрузка → вход (если сессии нет) или двор. Превью — только один раз на устройстве.
 */
type Phase = "preview" | "loading" | "gate";

function App() {
  const state = useStore();
  const [phase, setPhase] = useState<Phase>(() => (introSeen() ? "loading" : "preview"));
  // До входа два окна: вход и регистрация аккаунта. Персонаж заводится после.
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");

  useEffect(() => {
    connect();
  }, []);

  if (phase === "preview") {
    return <Preview lang={state.lang} onDone={() => setPhase("loading")} />;
  }

  // Экран входа или двора рисуется сразу; загрузка лежит поверх, пока он готовится.
  const gate = renderGate();
  if (phase === "loading") {
    return (
      <>
        {gate}
        <Loading lang={state.lang} onDone={() => setPhase("gate")} />
      </>
    );
  }
  return gate;

  function renderGate() {
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
}

// Сначала сцена: canvas занимает #pixi-root. HUD (React) монтируется в
// #hud-root поверх. Инициализация Pixi не блокирует рендер HUD.
void gameApp
  .init(document.getElementById("pixi-root") as HTMLElement)
  .then(() => {
    if (gameApp.instance) mountCourtScene(gameApp.instance);
  })
  .catch((error: unknown) => console.error("[Pixi] Initialization failed", error));

createRoot(document.getElementById("hud-root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
