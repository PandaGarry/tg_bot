import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { connect } from "./net.js";
import { store } from "./store.js";
import { useStore } from "./useStore.js";
import { introSeen } from "./shell/firstRun.js";
import { LoginScreen } from "./ui/entry/LoginScreen.js";
import { CreateScreen } from "./ui/entry/CreateScreen.js";
import { RegisterScreen } from "./ui/entry/RegisterScreen.js";
import { Preview } from "./ui/Preview.js";
import { Loading } from "./ui/Loading.js";
import { World } from "./ui/World.js";
import { initializeUiMockup } from "./ui/mockups.js";
import { statusKey } from "./i18n/index.js";

// Восстанавливает только локальный CSS-вариант, чтобы его было видно на экранах входа и создания лорда.
initializeUiMockup();

/**
 * Порядок экранов: первый запуск — превью → загрузка → вход/регистрация → создание лорда → двор.
 * Повторный вход — загрузка → вход (если сессии нет) или двор. Превью — только один раз на устройстве.
 */
type Phase = "preview" | "loading" | "gate";

// Pixi и изометрическая сцена загружаются только после входа в мир.
// На экранах превью/входа/создания лорда WebGL не нужен и не должен попадать
// в критический initial bundle. Bridge сохраняет последние state/mode события
// до позднего монтирования сцены.
let gameScenePromise: Promise<void> | null = null;

function initializeGameScene(): Promise<void> {
  if (gameScenePromise) return gameScenePromise;
  gameScenePromise = (async () => {
    const [{ gameApp }, { mountCourtScene }] = await Promise.all([
      import("./game/core/application.js"),
      import("./game/court/courtScene.js"),
    ]);
    const root = document.getElementById("pixi-root");
    if (!root) throw new Error("Pixi root element is missing");
    await gameApp.init(root);
    if (gameApp.instance) mountCourtScene(gameApp.instance);
  })().catch((error: unknown) => {
    gameScenePromise = null;
    throw error;
  });
  return gameScenePromise;
}

function App() {
  const state = useStore();
  const [phase, setPhase] = useState<Phase>(() => (introSeen() ? "loading" : "preview"));
  // До входа два окна: вход и регистрация аккаунта. Персонаж заводится после.
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");

  useEffect(() => {
    connect();
  }, []);

  useEffect(() => {
    if (!state.auth || state.auth.needsLord || !state.view?.me) return;
    void initializeGameScene().catch((error: unknown) => console.error("[Pixi] Initialization failed", error));
  }, [state.auth?.needsLord, state.view?.me?.id]);

  if (phase === "preview") {
    return <Preview lang={state.lang} onDone={() => setPhase("loading")} />;
  }

  // Во время загрузки поля входа ещё не смонтированы: браузер не показывает окно автозаполнения раньше времени (14.10).
  if (phase === "loading") {
    return <Loading lang={state.lang} onDone={() => setPhase("gate")} />;
  }
  return renderGate();

  function renderGate() {
    if (!state.auth) {
      if (authScreen === "register") {
        return <RegisterScreen lang={state.lang} onLogin={() => setAuthScreen("login")} />;
      }
      return (
        <LoginScreen
          lang={state.lang}
          statusKey={statusKey(state.status)}
          onRegister={() => setAuthScreen("register")}
        />
      );
    }

    const view = state.view;
    if (state.auth.needsLord || !view?.me) {
      return <CreateScreen lang={state.lang} view={view} serverNow={state.view?.world.now ?? state.clockOffset + Date.now()} />;
    }

    return <World view={view} lang={state.lang} serverNow={state.view?.world.now ?? state.clockOffset + Date.now()} />;
  }
}

createRoot(document.getElementById("hud-root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
