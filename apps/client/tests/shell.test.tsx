/**
 * Оболочка: вступление, хроника, создание лорда, двор.
 * Проверяется порядок экранов и то, что тексты приходят ключами словаря.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INTRO_KEYS, chronicleEntries, clearChronicle } from "../src/shell/chronicle.js";
import { introSeen } from "../src/shell/firstRun.js";
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
