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
  /** Срок жизни сессии. */
  sessionDays: 30,
  /** Имя лорда: знаков. */
  lordNameMin: 2,
  lordNameMax: 18,
} as const;

/** Ключи отказов ядра. Ключи модулей живут в словарях модулей. */
export const KERNEL_KEYS = {
  disabled: "kernel.module.disabled",
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
} as const;

export const DEFAULT_LOCALE = "ru";
export type Locale = "ru" | "en";
