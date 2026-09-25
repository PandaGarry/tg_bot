/**
 * Оболочка: вступление, хроника, создание лорда, двор.
 * Проверяется порядок экранов и то, что тексты приходят ключами словаря.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INTRO_KEYS, chronicleEntries, clearChronicle } from "../src/shell/chronicle.js";
import { introSeen } from "../src/shell/firstRun.js";
import * as net from "../src/net.js";
import { Boot } from "../src/ui/Boot.js";
import { Register } from "../src/ui/Register.js";
import { Slides } from "../src/ui/Slides.js";
import { Chronicle } from "../src/ui/Chronicle.js";
import { Create } from "../src/ui/Create.js";
import { World } from "../src/ui/World.js";
import { shellStrings } from "../src/i18n/shell.js";

beforeEach(() => {
  localStorage.clear();
  clearChronicle();
});

afterEach(() => {
  cleanup();
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

describe("вступление", () => {
  it("восемь кадров, пропуск со второго, последний кадр ведёт к двору", () => {
    const done = vi.fn();
    render(<Slides lang="ru" onDone={done} />);

    expect(screen.getByTestId("slide-text").textContent).toBe("Жили себе люди.");
    expect(screen.queryByRole("button", { name: "Пропустить" })).toBeNull();
    expect(screen.getByRole("button", { name: "Дальше" })).toBeTruthy();

    for (let step = 1; step < INTRO_KEYS.length; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    }

    // Последний кадр предлагает занять двор, а не листать дальше.
    expect(screen.getByRole("button", { name: "Занять двор" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Дальше" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Занять двор" }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(introSeen()).toBe(true);
  });

  it("пропуск виден со второго кадра и записывает вступление в хронику", () => {
    const done = vi.fn();
    render(<Slides lang="ru" onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(screen.getByRole("button", { name: "Пропустить" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    expect(done).toHaveBeenCalledTimes(1);
    // Текст слайдов остаётся в хронике целиком, даже если игрок пропустил кадры.
    expect(chronicleEntries().map((entry) => entry.key)).toEqual([...INTRO_KEYS]);
  });

  it("английский текст есть у каждого кадра", () => {
    const ru = shellStrings.ru as Record<string, string>;
    const en = shellStrings.en as Record<string, string>;
    for (const key of INTRO_KEYS) {
      expect(ru[key]?.length ?? 0).toBeGreaterThan(0);
      expect(en[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("хроника", () => {
  it("показывает записи словами языка, а не сырыми ключами", () => {
    render(<Slides lang="ru" onDone={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Дальше" }));
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    cleanup();

    render(<Chronicle lang="ru" />);
    expect(screen.getByText("Жили себе люди.")).toBeTruthy();

    cleanup();
    render(<Chronicle lang="en" />);
    expect(screen.getByText("People were doing fine.")).toBeTruthy();
    cleanup();
    render(<Chronicle lang="en" />);
    expect(screen.queryByText("shell.slide.1")).toBeNull();
  });

  it("пустая хроника говорит об этом словами словаря", () => {
    render(<Chronicle lang="ru" />);
    expect(screen.getByText("Хроника пока пуста")).toBeTruthy();
  });
});

describe("двор", () => {
  it("после создания виден двор и фраза про частокол, и она остаётся в хронике", () => {
    render(<World view={view()} lang="ru" serverNow={1} />);

    expect(screen.getByText("Живые уже у частокола. Их много. Пирогов нет. Частокол пока держит. Дальше это ваша работа.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Двор" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Хроника" }));
    expect(screen.getAllByText("Живые уже у частокола. Их много. Пирогов нет. Частокол пока держит. Дальше это ваша работа.").length).toBeGreaterThan(0);

    // Хронист говорит один раз: повторный вход фразу не удваивает.
    cleanup();
    render(<World view={view()} lang="ru" serverNow={2} />);
    expect(chronicleEntries().filter((entry) => entry.key === "shell.tutor.palisade")).toHaveLength(1);
  });
});

describe("создание лорда", () => {
  it("восемь голов, шесть знаков, восемь цветов, три типа", () => {
    render(<Create lang="ru" view={null} serverNow={1} />);
    expect(screen.getByText("Портрет")).toBeTruthy();
    expect(screen.getByText("Знамя")).toBeTruthy();
    expect(screen.getByText("Плоть")).toBeTruthy();
    expect(screen.getByText("Кость")).toBeTruthy();
    expect(screen.getByText("Спора")).toBeTruthy();
    expect(screen.getByText("Замок чуть лучше держит удар")).toBeTruthy();
    // Кнопка закрыта, пока имя короткое: игра пишет, чего не хватает, и не шутит.
    expect(screen.getByRole("button", { name: "Занять двор" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Костяной Лорд" } });
    expect(screen.getByRole("button", { name: "Занять двор" }).hasAttribute("disabled")).toBe(false);
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

    expect((screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("register-problem").textContent).toBe("Пароли не совпадают");
  });

  it("кривая почта и русский логин не проходят до сервера", () => {
    render(<Register lang="ru" onLogin={() => {}} />);
    fillRegister({ email: "почта-без-собаки", login: "Лорд_Тьмы" });

    expect((screen.getByRole("button", { name: "Зарегистрироваться" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("register-problem").textContent).toBe(
      "Логин: 3–24 знака, латиница, цифры, точка, дефис, подчёркивание",
    );
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
    fireEvent.click(screen.getByRole("button", { name: "Уже заведён вход — войти" }));
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
