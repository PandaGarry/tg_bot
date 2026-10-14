/**
 * Оболочка: вступление, хроника, создание лорда, двор.
 * Проверяется порядок экранов и то, что тексты приходят ключами словаря.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INTRO_KEYS, chronicleEntries, clearChronicle } from "../src/shell/chronicle.js";
import { introSeen } from "../src/shell/firstRun.js";
import * as net from "../src/net.js";
import { LoginScreen as Boot } from "../src/ui/entry/LoginScreen.js";
import { RegisterScreen as Register } from "../src/ui/entry/RegisterScreen.js";
import { Preview, PAUSE_AFTER_VOICE_MS, SILENT_HOLD_MS, previewAudioSrc } from "../src/ui/Preview.js";
import { Loading, LEAVE_MS, LOADING_MS } from "../src/ui/Loading.js";
import { Chronicle } from "../src/ui/Chronicle.js";
import { CreateScreen as Create } from "../src/ui/entry/CreateScreen.js";
import { World } from "../src/ui/World.js";
import { shellStrings } from "../src/i18n/shell.js";
import { store } from "../src/store.js";
import { bridge } from "../src/game/bridge.js";

beforeEach(() => {
  localStorage.clear();
  clearChronicle();
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.uiMockup;
  vi.restoreAllMocks();
});

/** Снимок вида мира: у лорда есть имя, склад пуст. */
function view() {
  return {
    world: { id: "world-1", name: "Первый мир", seed: 1, size: 200, zones: 5, zonePit: 4, zoneCapital: 5, now: 1, downtimeMs: 0 },
    me: { id: "lord-1", name: "Костяной Лорд", clanId: null, portrait: "portrait-1", bannerSign: "skull", bannerColor: "bone", type: "bone" },
    stock: {},
    modules: {},
  };
}

/** Заглушка Audio: тест сам решает, когда звук закончился или не запустился. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  listeners: Record<string, Array<() => void>> = {};
  playResult: Promise<void>;
  constructor(src: string) {
    this.src = src;
    this.playResult = Promise.resolve();
    FakeAudio.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  play() {
    return this.playResult;
  }
  pause() {}
  fire(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}

function currentAudio(): FakeAudio {
  const last = FakeAudio.instances[FakeAudio.instances.length - 1];
  if (!last) throw new Error("звук не создан");
  return last;
}

describe("превью первого запуска", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("десять кадров: первый без пропуска, со второго — пропуск, последний — «Начать»", () => {
    const done = vi.fn();
    render(<Preview lang="ru" onDone={done} />);

    expect(INTRO_KEYS).toHaveLength(10);
    expect(screen.getByTestId("preview-text").textContent).toBe(shellStrings.ru[INTRO_KEYS[0] as keyof typeof shellStrings.ru]);
    expect(screen.queryByRole("button", { name: "Пропустить" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(screen.getByRole("button", { name: "Пропустить" })).toBeTruthy();

    for (let step = 2; step < INTRO_KEYS.length; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    }
    expect(screen.getByRole("button", { name: "Начать" })).toBeTruthy();
    expect(done).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Начать" }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(introSeen()).toBe(true);
  });

  it("пропуск со второго кадра ведёт к загрузке и записывает вступление в хронику", () => {
    const done = vi.fn();
    render(<Preview lang="ru" onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));

    expect(done).toHaveBeenCalledTimes(1);
    expect(introSeen()).toBe(true);
    expect(chronicleEntries().map((entry) => entry.key)).toEqual([...INTRO_KEYS]);
  });

  it("после окончания озвучки кадр уходит через паузу 2 с, а не сразу", () => {
    render(<Preview lang="en" onDone={() => undefined} />);
    expect(currentAudio().src).toBe(previewAudioSrc("en", 0));
    expect(currentAudio().src).toBe("/audio/preview/en/frame-01.mp3");

    act(() => currentAudio().fire("ended"));
    act(() => vi.advanceTimersByTime(PAUSE_AFTER_VOICE_MS - 1));
    expect(currentAudio().src).toBe(previewAudioSrc("en", 0));

    act(() => vi.advanceTimersByTime(1));
    expect(currentAudio().src).toBe(previewAudioSrc("en", 1));
    expect(screen.getByTestId("preview-text").textContent).toBe(shellStrings.en[INTRO_KEYS[1] as keyof typeof shellStrings.en]);
  });

  it("если звук не запускается, кадр держится фиксированное время", () => {
    render(<Preview lang="ru" onDone={() => undefined} />);
    act(() => currentAudio().fire("error"));
    act(() => vi.advanceTimersByTime(SILENT_HOLD_MS));
    expect(currentAudio().src).toBe(previewAudioSrc("ru", 1));
  });

  it("отказ play() тоже даёт фиксированное время", async () => {
    const original = FakeAudio.prototype.play;
    FakeAudio.prototype.play = () => Promise.reject(new Error("autoplay"));
    try {
      render(<Preview lang="ru" onDone={() => undefined} />);
      await act(async () => {
        await Promise.resolve();
      });
      act(() => vi.advanceTimersByTime(SILENT_HOLD_MS));
      expect(currentAudio().src).toBe(previewAudioSrc("ru", 1));
    } finally {
      FakeAudio.prototype.play = original;
    }
  });

  it("каждый кадр и подсказка загрузки есть на русском и английском", () => {
    const ru = shellStrings.ru as Record<string, string>;
    const en = shellStrings.en as Record<string, string>;
    const keys = [...INTRO_KEYS, "shell.loading.title", "shell.loading.hint.1", "shell.loading.hint.2", "shell.loading.hint.3", "shell.preview.begin"];
    for (const key of keys) {
      expect(ru[key]?.length ?? 0, key).toBeGreaterThan(0);
      expect(en[key]?.length ?? 0, key).toBeGreaterThan(0);
    }
  });
});

describe("загрузка", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("через LOADING_MS сообщает о готовности, подсказка меняется", () => {
    const done = vi.fn();
    render(<Loading lang="ru" onDone={done} />);
    const first = screen.getByTestId("loading-hint").textContent;
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByTestId("loading-hint").textContent).not.toBe(first);
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(LOADING_MS));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("сначала затухает (класс load-leave), и только потом отдаёт экран", () => {
    const done = vi.fn();
    const { container } = render(<Loading lang="ru" onDone={done} />);
    act(() => vi.advanceTimersByTime(LOADING_MS - 1));
    expect(container.querySelector(".load-leave")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector(".load-leave")).not.toBeNull();
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(LEAVE_MS));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("хроника", () => {
  it("показывает записи словами языка, а не сырыми ключами", () => {
    vi.stubGlobal("Audio", FakeAudio);
    FakeAudio.instances = [];
    render(<Preview lang="ru" onDone={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    cleanup();
    vi.unstubAllGlobals();

    render(<Chronicle lang="ru" />);
    expect(screen.getAllByText(/./).some((node) => node.textContent?.startsWith("shell.preview"))).toBe(false);

    cleanup();
    render(<Chronicle lang="en" />);
    expect(screen.queryByText("shell.preview.1")).toBeNull();
  });

  it("пустая хроника говорит об этом словами словаря", () => {
    render(<Chronicle lang="ru" />);
    expect(screen.getByText("Хроника пока пуста")).toBeTruthy();
  });
});

describe("вход и регистрация", () => {
  it("вход: поля с подписями, кнопка выключена до валидных данных, пароль можно показать", () => {
    render(<Boot lang="ru" statusKey="shell.boot.subtitle" onRegister={() => undefined} />);
    const login = screen.getByLabelText("Логин или почта") as HTMLInputElement;
    const password = screen.getByLabelText("Пароль") as HTMLInputElement;
    expect(password.type).toBe("password");
    expect((screen.getByRole("button", { name: "Войти" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(login, { target: { value: "lord" } });
    fireEvent.change(password, { target: { value: "longenough" } });
    expect((screen.getByRole("button", { name: "Войти" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Показать пароль" }));
    expect(password.type).toBe("text");
  });

  it("Google и Яндекс ID показывают понятное сообщение, а не падают", () => {
    render(<Boot lang="ru" statusKey="shell.boot.subtitle" onRegister={() => undefined} />);
    fireEvent.click(screen.getByTestId("boot-google"));
    expect(screen.getByRole("status").textContent).toBe(
      "Вход через Google ID пока не подключён. Войдите логином и паролем.",
    );
    fireEvent.click(screen.getByTestId("boot-yandex"));
    expect(screen.getByRole("status").textContent).toContain("Яндекс ID");
  });

  it("переход к регистрации и подсказка о неполной форме", () => {
    const toRegister = vi.fn();
    const { unmount } = render(<Boot lang="en" statusKey="shell.boot.subtitle" onRegister={toRegister} />);
    fireEvent.click(screen.getByTestId("boot-to-register"));
    expect(toRegister).toHaveBeenCalledTimes(1);
    unmount();

    render(<Register lang="en" onLogin={() => undefined} />);
    // На пустой форме ошибок нет: они появляются после ухода с поля.
    expect(screen.queryByRole("alert")).toBeNull();
    const login = screen.getByTestId("register-login");
    fireEvent.change(login, { target: { value: "ab" } });
    fireEvent.blur(login);
    expect(screen.getByRole("alert").textContent).toBe(
      "Login: 3–24 characters, Latin letters, digits, dot, hyphen, underscore",
    );
  });
});

describe("двор", () => {
  it("после создания виден двор и фраза про частокол, и она остаётся в хронике", () => {
    render(<World view={view()} lang="ru" serverNow={1} />);

    expect(screen.getByText("Живые уже у частокола. Их много. Пирогов нет. Частокол пока держит. Дальше это ваша работа.")).toBeTruthy();
    // На экране двора кнопка «Двор» не нужна: центральная кнопка нижнего меню ведёт на карту.
    expect(screen.getByRole("button", { name: "Карта" })).toBeTruthy();

    // Записи хрониста сохраняются; отдельной кнопки «Летопись» в нижней навигации нет.
    expect(chronicleEntries().some((entry) => entry.key === "shell.tutor.palisade")).toBe(true);
    expect(screen.queryByRole("button", { name: "Летопись" })).toBeNull();

    // Хронист говорит один раз: повторный вход фразу не удваивает.
    cleanup();
    render(<World view={view()} lang="ru" serverNow={2} />);
    expect(chronicleEntries().filter((entry) => entry.key === "shell.tutor.palisade")).toHaveLength(1);
  });

  it("кнопка прототипа скрыта на экране двора (код сохранён для следующих тестов)", () => {
    render(<World view={view()} lang="ru" serverNow={1} />);
    expect(screen.queryByRole("button", { name: "Прототип раскладки" })).toBeNull();
  });

  it("новая панель строительства не возвращает старые ячейки и ведёт к подтверждению клетки", () => {
    const fundedView = { ...view(), stock: { wood: 100, stone: 100 } };
    const { container } = render(<World view={fundedView} lang="ru" serverNow={1} />);
    expect(container.querySelector(".hud-top")).toBeNull();
    expect(container.querySelector(".ch-profile")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Строительство" }));
    fireEvent.click(screen.getByRole("button", { name: /Лесопилка/ }));
    expect(container.querySelector(".concept-build-panel")).toBeNull();
    act(() => bridge.emit("tile:click", { x: 4, z: 7 }));
    expect(screen.getByRole("button", { name: "Поставить" })).toBeTruthy();
  });
});

describe("аккаунт", () => {
  it("выход из игры стирает сессию и возвращает окно входа с регистрацией", () => {
    store.setAuth({ needsLord: false, token: "токен-из-теста-0123456789", accountId: "acc-1" }, "токен-из-теста-0123456789");
    expect(localStorage.getItem("tdl.token")).toBe("токен-из-теста-0123456789");

    render(<World view={view()} lang="ru" serverNow={1} />);
    fireEvent.click(document.querySelector(".ch-profile") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Выйти из аккаунта" }));

    // Токен убран: и из памяти, и с устройства — чужой человек за этим телефоном
    // увидит окно входа, а не двор ушедшего.
    expect(store.get().auth).toBe(null);
    expect(localStorage.getItem("tdl.token")).toBe(null);
  });
});

describe("создание лорда", () => {
  it("один экран: имя, портрет, знамя, тип; кнопка открыта только с правильным именем", () => {
    render(<Create lang="ru" view={null} serverNow={1} />);
    // Нет шагов: все части на одном экране.
    expect(screen.queryByText(/Шаг \d из/)).toBeNull();
    expect(screen.getByRole("button", { name: "Занять двор" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Костяной Лорд" } });
    expect(screen.getByRole("button", { name: "Занять двор" }).hasAttribute("disabled")).toBe(false);
    // Десять портретов, шесть знаков, восемь цветов, три типа.
    expect(screen.getByRole("radiogroup", { name: "Портрет" }).querySelectorAll("[role=radio]").length).toBe(10);
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    expect(screen.getByRole("radio", { name: "3" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("radio").length).toBe(10 + 6 + 8 + 3);
    // Строка лорда сверху обновляется по имени.
    expect(screen.getByText("Костяной Лорд")).toBeTruthy();
  });
});

describe("вход и регистрация", () => {
  it("вход — одно окно: логин или почта, пароль, кнопка на регистрацию", () => {
    const toRegister = vi.fn();
    render(<Boot lang="ru" statusKey="shell.status.online" onRegister={toRegister} />);

    expect(screen.getByText("Логин или почта")).toBeTruthy();
    expect(screen.getByText("Пароль")).toBeTruthy();
    // Полей аккаунта тут нет: их спрашивают в отдельном окне.
    expect(screen.queryByTestId("register-email")).toBeNull();
    expect(screen.queryByTestId("register-rules")).toBeNull();

    fireEvent.click(screen.getByTestId("boot-to-register"));
    // Окно входа лишь просит открыть регистрацию: само оно аккаунт не заводит.
    expect(toRegister).toHaveBeenCalledTimes(1);
  });

  it("регистрация — отдельное окно: логин, почта, пароль дважды, согласия", () => {
    render(<Register lang="ru" onLogin={() => {}} />);

    expect(screen.getByText("Регистрация аккаунта")).toBeTruthy();
    for (const id of ["register-login", "register-email", "register-password", "register-repeat"]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    // Логин и никнейм — разные вещи: окно об этом говорит.
    expect(screen.getByText(/Логин и имя лорда — разные вещи/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("без согласия с правилами кнопка молчит и объясняет причину", () => {
    render(<Register lang="ru" onLogin={() => {}} />);
    fillRegister({ rules: false });

    const submit = screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByTestId("register-problem").textContent).toBe(
      "Без согласия с правилами аккаунт не заводится",
    );
  });

  it("пароль и повтор не совпали — отправки нет", () => {
    render(<Register lang="ru" onLogin={() => {}} />);
    fillRegister({ repeat: "другой-пароль-12345" });
    fireEvent.blur(screen.getByTestId("register-repeat"));

    expect((screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Пароли не совпадают");
  });

  it("кривая почта и русский логин не проходят до сервера", () => {
    render(<Register lang="ru" onLogin={() => {}} />);
    fillRegister({ email: "почта-без-собаки", login: "Лорд_Тьмы" });
    fireEvent.blur(screen.getByTestId("register-email"));
    fireEvent.blur(screen.getByTestId("register-login"));

    expect((screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement).disabled).toBe(true);
    const messages = screen.getAllByRole("alert").map((node) => node.textContent);
    expect(messages).toContain("Почта написана неверно");
    expect(messages).toContain("Логин: 3–24 знака, латиница, цифры, точка, дефис, подчёркивание");
  });

  it("верные поля включают кнопку и шлют регистрацию вместе с согласиями", async () => {
    const sent = vi.spyOn(net, "register").mockImplementation(() => {});
    render(<Register lang="ru" onLogin={() => {}} />);
    fillRegister({ mail: true });

    const submit = screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    expect(screen.getByTestId("register-problem").textContent).toBe("");

    fireEvent.click(submit);
    expect(sent).toHaveBeenCalledWith("lord.dark", "пароль-из-теста", "lord.dark@mail.test", {
      rules: true,
      mail: true,
    });
    expect(screen.getByRole("button", { name: "Заводим вход…" })).toBeTruthy();
  });

  it("кнопка возврата ведёт ко входу", () => {
    const toLogin = vi.fn();
    render(<Register lang="ru" onLogin={toLogin} />);
    fireEvent.click(screen.getByTestId("register-back"));
    expect(toLogin).toHaveBeenCalledTimes(1);
  });
});

/** Заполняет окно регистрации как игрок: поля по умолчанию верные. */
function fillRegister(over: { login?: string; email?: string; repeat?: string; rules?: boolean; mail?: boolean } = {}) {
  fireEvent.change(screen.getByTestId("register-login"), { target: { value: over.login ?? "lord.dark" } });
  fireEvent.change(screen.getByTestId("register-email"), {
    target: { value: over.email ?? "lord.dark@mail.test" },
  });
  fireEvent.change(screen.getByTestId("register-password"), { target: { value: "пароль-из-теста" } });
  fireEvent.change(screen.getByTestId("register-repeat"), {
    target: { value: over.repeat ?? "пароль-из-теста" },
  });
  if (over.rules !== false) fireEvent.click(screen.getByTestId("register-rules"));
  if (over.mail) fireEvent.click(screen.getByTestId("register-mail"));
}

describe("ошибки для игрока", () => {
  it("игровые фразы ядра не выходят на экран: «Не пустили» → «Логин или пароль не подходят.»", async () => {
    const { friendlyError } = await import("../src/shell/errors.js");
    expect(friendlyError("ru", "kernel.login.failed")).toBe("Логин или пароль не подходят.");
    expect(friendlyError("ru", "kernel.login.failed")).not.toContain("Не пустили");
    expect(friendlyError("ru", "kernel.неизвестно")).toBe("Что-то пошло не так. Попробуйте ещё раз.");
    expect(friendlyError("en", "kernel.login.failed")).toBe("Login or password is incorrect.");
  });
});

describe("отказы ядра на экранах входа и создания", () => {
  it("старая ошибка из прошлой попытки не всплывает при открытии входа", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);
    store.addError("kernel.login.failed");
    now.mockReturnValue(2000);
    render(<Boot lang="ru" statusKey="shell.boot.subtitle" onRegister={() => {}} />);
    expect(screen.queryByText("Логин или пароль не подходят.")).toBeNull();
    now.mockRestore();
  });

  it("свежий отказ входа показан спокойной фразой, а не игровой", () => {
    render(<Boot lang="ru" statusKey="shell.boot.subtitle" onRegister={() => {}} />);
    act(() => {
      store.addError("kernel.login.failed");
    });
    expect(screen.getByText("Логин или пароль не подходят.")).toBeTruthy();
    expect(screen.queryByText(/Не пустили/)).toBeNull();
  });
});
