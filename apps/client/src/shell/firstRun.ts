/**
 * Первый запуск на устройстве. Слайды крутятся один раз: узнаём устройство
 * по отметке в хранилище браузера, а не по лорду — лорда в этот миг ещё нет.
 */

const KEY = "tdl.intro.seen";

export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Приватный режим: слайды показываются заново, это не ошибка.
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // не критично
  }
}
