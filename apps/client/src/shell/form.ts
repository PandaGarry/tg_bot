/**
 * Правила полей входа и регистрации. Логин и почта проверяются здесь, чтобы
 * игрок видел ошибку до отправки; те же правила повторяет сервер.
 */

import { LIMITS } from "@tdl/protocol";

/** Логин: латиница, цифры, точка, дефис, подчёркивание. Знаки — технический выбор. */
export function goodLogin(login: string): boolean {
  const value = login.trim();
  return value.length >= LIMITS.loginMin && value.length <= LIMITS.loginMax && /^[A-Za-z0-9._-]+$/.test(value);
}

export function goodEmail(email: string): boolean {
  const value = email.trim();
  return value.length <= LIMITS.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function goodPassword(password: string): boolean {
  return password.length >= LIMITS.passwordMin && password.length <= LIMITS.passwordMax;
}

export function samePassword(password: string, repeat: string): boolean {
  return password.length > 0 && password === repeat;
}
