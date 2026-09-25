/**
 * Версия протокола проверяется при входе. Старый клиент команды не шлёт,
 * пока не обновится: иначе старая команда читается новым модулем иначе.
 */
export const PROTOCOL_VERSION = 1;

/** Пределы ворот. Числа технические, не игровые. */
export const LIMITS = {
  /** Размер одного сообщения клиента. */
  maxMessageBytes: 8 * 1024,
  /** Команд в секунду на сессию. */
  commandsPerSecond: 20,
  /** Сколько байт может ждать отправки одному соединению. Дальше клиент считается медленным. */
  sendBufferBytes: 1024 * 1024,
  /** Срок жизни сессии. */
  sessionDays: 30,
  /** Имя лорда: знаков. */
  lordNameMin: 2,
  lordNameMax: 18,
  /** Логин аккаунта: латиница, цифры, точка, дефис, подчёркивание. */
  loginMin: 3,
  loginMax: 24,
  /** Почта: знаков. Проверка полная — на сервере. */
  emailMax: 120,
  /** Пароль: знаков. */
  passwordMin: 8,
  passwordMax: 72,
} as const;

/** Ключи отказов ядра. Ключи модулей живут в словарях модулей. */
export const KERNEL_KEYS = {
  disabled: "kernel.module.disabled",
  betweenWindows: "kernel.unit.between-windows",
  quarantine: "kernel.unit.quarantine",
  stale: "kernel.command.stale",
  unknown: "kernel.command.unknown",
  badInput: "kernel.command.bad-input",
  forbidden: "kernel.command.forbidden",
  insufficient: "kernel.stock.insufficient",
  protocol: "kernel.protocol.outdated",
  session: "kernel.session.expired",
  rate: "kernel.session.rate",
  busy: "kernel.busy",
  generic: "kernel.failed",
  registration: "kernel.registration.closed",
  login: "kernel.login.failed",
  nameTaken: "kernel.lord.name-taken",
  nameBad: "kernel.lord.name-bad",
  emailBad: "kernel.account.email-bad",
  rules: "kernel.account.rules",
} as const;

export const DEFAULT_LOCALE = "ru";
export type Locale = "ru" | "en";
