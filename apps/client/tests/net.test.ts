import { afterEach, describe, expect, it, vi } from "vitest";

type Listener = (event: { data?: string }) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(value: string): void {
    this.sent.push(value);
  }

  emit(type: string, event: { data?: string } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  message(value: unknown): void {
    this.emit("message", { data: JSON.stringify(value) });
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }
}

describe("клиентская сессия и переподключение", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.clear();
    FakeWebSocket.instances = [];
  });

  it("восстанавливает сохранённый токен и не считает logout успешным без ответа сервера", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.resetModules();

    const [{ connect, sendCommand, logout }, { store }] = await Promise.all([
      import("../src/net.js"),
      import("../src/store.js"),
    ]);

    localStorage.setItem("tdl.token", "persisted-session-token");
    connect();

    const first = FakeWebSocket.instances[0];
    expect(first).toBeDefined();
    first!.open();
    expect(JSON.parse(first!.sent[0] ?? "{}")).toMatchObject({
      t: "auth.token",
      token: "persisted-session-token",
    });

    // Открытый транспорт без auth-ответа не принимает игровые команды.
    sendCommand("_probe.poke", { steps: 1 });
    expect(first!.sent).toHaveLength(1);
    expect(store.get().errors[0]?.key).toBe("kernel.connection.lost");

    first!.message({
      t: "auth",
      serverNow: Date.now(),
      token: "persisted-session-token",
      accountId: "account-1",
      worldId: "world-1",
      needsLord: false,
    });
    expect(store.get().auth?.token).toBe("persisted-session-token");

    // Разрыв связи не стирает сессию и logout не притворяется подтверждённым.
    first!.close();
    logout();
    expect(localStorage.getItem("tdl.token")).toBe("persisted-session-token");
    expect(store.get().auth?.token).toBe("persisted-session-token");

    // Reconnect повторно предъявляет сохранённый токен.
    await vi.advanceTimersByTimeAsync(2_000);
    const second = FakeWebSocket.instances[1];
    expect(second).toBeDefined();
    second!.open();
    expect(JSON.parse(second!.sent[0] ?? "{}")).toMatchObject({
      t: "auth.token",
      token: "persisted-session-token",
    });
    second!.message({
      t: "auth",
      serverNow: Date.now(),
      token: "persisted-session-token",
      accountId: "account-1",
      worldId: "world-1",
      needsLord: false,
    });

    logout();
    expect(JSON.parse(second!.sent[1] ?? "{}")).toMatchObject({
      t: "auth.logout",
      token: "persisted-session-token",
    });
    // Токен остаётся до ответа сервера, но новые игровые команды уже блокируются.
    expect(localStorage.getItem("tdl.token")).toBe("persisted-session-token");
    sendCommand("_probe.poke", { steps: 1 });
    expect(second!.sent).toHaveLength(2);

    second!.message({ t: "out", serverNow: Date.now(), ok: true });
    expect(localStorage.getItem("tdl.token")).toBeNull();
    expect(store.get().auth).toBeNull();
    second!.close();
  });
});
