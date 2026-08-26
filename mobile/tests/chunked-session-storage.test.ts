import { describe, expect, it } from "vitest";

import {
  createChunkedSessionStorage,
  type NativeKeyValueStore,
} from "../lib/supabase/chunked-session-storage";

class MemorySecureStore implements NativeKeyValueStore {
  readonly values = new Map<string, string>();
  failWhenWriting: string | null = null;

  async getItemAsync(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string) {
    if (key === this.failWhenWriting) {
      throw new Error(`simulated SecureStore write failure for ${key}`);
    }
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string) {
    this.values.delete(key);
  }
}

describe("chunked native session storage", () => {
  it("keeps the committed session readable when a replacement write is interrupted", async () => {
    const secureStore = new MemorySecureStore();
    const generations = ["first", "second"];
    const storage = createChunkedSessionStorage(secureStore, {
      chunkSize: 4,
      createGeneration: () => generations.shift() ?? "unexpected",
    });

    await storage.setItem("session", "old-refresh-token");
    secureStore.failWhenWriting = "session.chunk.second.1";

    await expect(
      storage.setItem("session", "new-refresh-token"),
    ).rejects.toThrow("simulated SecureStore write failure");

    expect(await storage.getItem("session")).toBe("old-refresh-token");
    expect(await secureStore.getItemAsync("session.meta")).toBe(
      JSON.stringify({ chunks: 5, generation: "first" }),
    );
  });

  it("publishes the replacement only after every chunk has been stored", async () => {
    const secureStore = new MemorySecureStore();
    const generations = ["first", "second"];
    const storage = createChunkedSessionStorage(secureStore, {
      chunkSize: 4,
      createGeneration: () => generations.shift() ?? "unexpected",
    });

    await storage.setItem("session", "old-token");
    await storage.setItem("session", "fresh-token");

    expect(await storage.getItem("session")).toBe("fresh-token");
    expect(await secureStore.getItemAsync("session.chunk.first.0")).toBeNull();
    expect(await secureStore.getItemAsync("session.meta")).toBe(
      JSON.stringify({ chunks: 3, generation: "second" }),
    );
  });

  it("keeps the previous chunk format readable if its first staged replacement fails", async () => {
    const secureStore = new MemorySecureStore();
    const storage = createChunkedSessionStorage(secureStore, {
      chunkSize: 4,
      createGeneration: () => "first",
    });
    secureStore.values.set("session.meta", JSON.stringify({ chunks: 2 }));
    secureStore.values.set("session.chunk.0", "old-");
    secureStore.values.set("session.chunk.1", "token");
    secureStore.failWhenWriting = "session.chunk.first.1";

    await expect(storage.setItem("session", "fresh-token")).rejects.toThrow(
      "simulated SecureStore write failure",
    );

    expect(await storage.getItem("session")).toBe("old-token");
    expect(await secureStore.getItemAsync("session.meta")).toBe(
      JSON.stringify({ chunks: 2 }),
    );
  });

  it("continues to read a legacy single-value session until Supabase writes a replacement", async () => {
    const secureStore = new MemorySecureStore();
    const storage = createChunkedSessionStorage(secureStore, {
      chunkSize: 4,
      createGeneration: () => "first",
    });
    secureStore.values.set("session", "legacy-session");

    expect(await storage.getItem("session")).toBe("legacy-session");

    await storage.setItem("session", "fresh-token");
    expect(await storage.getItem("session")).toBe("fresh-token");
    expect(await secureStore.getItemAsync("session")).toBeNull();
  });
});
