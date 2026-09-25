/**
 * Слова ядра: ключи отказов и строки отчёта. Клиент показывает отказ
 * по ключу, сырое сообщение исключения на экран не выходит.
 */

export const kernelStrings = {
  ru: {
    "kernel.report.gathered": "Собрано: {resource} — {amount}",
    "kernel.report.stock_full": "Склад полон",
    "kernel.module.disabled": "Этот узел сейчас закрыт",
    "kernel.command.stale": "Команда устарела",
    "kernel.command.unknown": "Такого действия нет",
    "kernel.command.bad-input": "Так нельзя",
    "kernel.command.forbidden": "Не ваше дело",
    "kernel.stock.insufficient": "Не хватает ресурса",
    "kernel.protocol.outdated": "Обновите страницу",
    "kernel.session.expired": "Сессия истекла, войдите снова",
    "kernel.session.rate": "Слишком часто",
    "kernel.busy": "Мир не успевает, повторите",
    "kernel.failed": "Действие не выполнено",
    "kernel.registration.closed": "Регистрация закрыта",
    "kernel.login.failed": "Не пустили",
    "kernel.lord.name-taken": "Такое имя уже занято",
    "kernel.lord.name-bad": "Имя не подходит: 2–18 знаков, буквы, цифры, пробел, дефис",
    "kernel.account.email-bad": "Почта написана неверно",
    "kernel.account.rules": "Без согласия с правилами аккаунт не заводится",
    "kernel.connection.lost": "Связь с миром потеряна",
    "kernel.connection.online": "Связь с миром есть",
  },
  en: {
    "kernel.report.gathered": "Gathered: {resource} — {amount}",
    "kernel.report.stock_full": "The store is full",
    "kernel.module.disabled": "This node is closed for now",
    "kernel.command.stale": "The command is stale",
    "kernel.command.unknown": "There is no such action",
    "kernel.command.bad-input": "That will not do",
    "kernel.command.forbidden": "Not yours to touch",
    "kernel.stock.insufficient": "Not enough resources",
    "kernel.protocol.outdated": "Reload the page",
    "kernel.session.expired": "Session expired, sign in again",
    "kernel.session.rate": "Too often",
    "kernel.busy": "The world is behind, try again",
    "kernel.failed": "The action was not done",
    "kernel.registration.closed": "Registration is closed",
    "kernel.login.failed": "No entry",
    "kernel.lord.name-taken": "That name is taken",
    "kernel.lord.name-bad": "Name must be 2–18 characters: letters, digits, space, hyphen",
    "kernel.account.email-bad": "The email address looks wrong",
    "kernel.account.rules": "An account is not created without agreeing to the rules",
    "kernel.connection.lost": "The world is out of reach",
    "kernel.connection.online": "The world is in reach",
  },
} as const;

export type KernelStringKey = keyof typeof kernelStrings.ru;
