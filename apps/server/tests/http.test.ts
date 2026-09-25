/**
 * Порт мира: статика клиента, точки состояния, закрытые двери.
 * Проверяется и то, что отдаётся, и то, что наружу выйти не должно:
 * выход из папки сборки, чужие методы, неизвестные пути.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, type HostConfig } from "@tdl/host";
import { bootServer, type BootedServer } from "../src/boot.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";

function testConfig(): HostConfig {
  const url = readTestDbUrl("server");
  if (!url) throw new Error("адрес тестовой базы не найден: запустите тесты пакета");
  return loadConfig({
    DATABASE_URL: url,
    WORLD_ID: `http-${randomUUID().slice(0, 12)}`,
    WORLD_NAME: "мир порта",
    WORLD_SEED: "13",
    WORLD_SIZE: "32",
    SESSION_SECRET: "test-secret-0123456789",
    REGISTRATION_OPEN: "1",
    PORT: "0",
    HOST: "127.0.0.1",
    NODE_ENV: "test",
  });
}

describe("порт мира", () => {
  let booted: BootedServer;
  let dist: string;

  beforeAll(async () => {
    // Своя папка сборки: статика проверяется без настоящего клиента.
    dist = await mkdtemp(join(tmpdir(), "tdl-dist-"));
    await mkdir(join(dist, "assets"), { recursive: true });
    await writeFile(join(dist, "index.html"), "<!doctype html><title>мир</title>", "utf8");
    await writeFile(join(dist, "assets", "app.js"), "export const ok = true;", "utf8");
    await writeFile(join(tmpdir(), "tdl-secret.txt"), "секрет наружу не выходит", "utf8");
    booted = await bootServer({ config: testConfig(), serveClient: true, clientDist: dist });
  }, 60_000);

  afterAll(async () => {
    await booted.stop("test");
    await rm(dist, { recursive: true, force: true });
    await rm(join(tmpdir(), "tdl-secret.txt"), { force: true });
  });

  it("здоровье мира отвечает счётчиками прохода", async () => {
    const response = await fetch(`http://127.0.0.1:${booted.port}/api/health`);
    const body = (await response.json()) as {
      ok: boolean;
      ready: boolean;
      stats: { epoch: number; pending: number; failures: number; lastDeadlineMs: number };
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.ready).toBe(true);
    expect(body.stats.epoch).toBeGreaterThan(0);
    expect(body.stats.pending).toBe(0);
    expect(body.stats.failures).toBe(0);
    expect(body.stats.lastDeadlineMs).toBeGreaterThanOrEqual(0);
  });

  it("страница, файл сборки и адрес без файла", async () => {
    const page = await fetch(`http://127.0.0.1:${booted.port}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("cache-control")).toBe("no-cache");
    expect(await page.text()).toContain("мир");

    const asset = await fetch(`http://127.0.0.1:${booted.port}/assets/app.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");

    // Адрес неизвестной страницы отдаёт оболочку: клиент сам решает, что рисовать.
    const deep = await fetch(`http://127.0.0.1:${booted.port}/clan/42`);
    expect(deep.status).toBe(200);
    expect(await deep.text()).toContain("мир");

    const head = await fetch(`http://127.0.0.1:${booted.port}/`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("выход из папки сборки закрыт", async () => {
    for (const path of [
      "/../tdl-secret.txt",
      "/../../tdl-secret.txt",
      "/%2e%2e%2ftdl-secret.txt",
      "/assets/../../tdl-secret.txt",
    ]) {
      const response = await fetch(`http://127.0.0.1:${booted.port}${path}`);
      const text = await response.text();
      expect(text).not.toContain("секрет");
      expect(text).toContain("мир");
    }
  });

  it("чужие методы и пути не проходят", async () => {
    const post = await fetch(`http://127.0.0.1:${booted.port}/clan/42`, { method: "POST", body: "{}" });
    expect(post.status).toBe(404);

    const private_ = await fetch(`http://127.0.0.1:${booted.port}/.env`);
    expect(private_.status).toBe(200);
    // Каталог сборки не отдаёт чужой файл: только оболочку.
    expect(await private_.text()).not.toContain("DATABASE_URL");

    const unknown = await fetch(`http://127.0.0.1:${booted.port}/api/unknown`);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("content-type")).toContain("application/json");
    expect(await unknown.json()).toEqual({ ok: false, error: "нет такого пути" });
  });

  it("отказы ядра видны служебной ручкой", async () => {
    const response = await fetch(`http://127.0.0.1:${booted.port}/api/kernel/rejections`);
    const body = (await response.json()) as { rows: unknown[] };
    expect(response.status).toBe(200);
    expect(Array.isArray(body.rows)).toBe(true);
  });
});
