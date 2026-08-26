export type NativeKeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

type NativeSessionMetadata = {
  chunks: number;
  generation?: string;
};

type ChunkedSessionStorageOptions = {
  chunkSize: number;
  createGeneration?: () => string;
};

function metadataKey(key: string) {
  return `${key}.meta`;
}

function legacyChunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

function generationChunkKey(key: string, generation: string, index: number) {
  return `${key}.chunk.${generation}.${index}`;
}

function parseMetadata(value: string | null): NativeSessionMetadata | null {
  if (!value) return null;

  try {
    const metadata = JSON.parse(value) as NativeSessionMetadata;
    const validGeneration =
      metadata.generation === undefined ||
      (typeof metadata.generation === "string" &&
        metadata.generation.length > 0);

    if (
      Number.isInteger(metadata.chunks) &&
      metadata.chunks > 0 &&
      validGeneration
    ) {
      return metadata;
    }
  } catch {
    // A damaged metadata entry is treated as unavailable rather than returning partial session JSON.
  }

  return null;
}

function chunkKey(key: string, metadata: NativeSessionMetadata, index: number) {
  return metadata.generation
    ? generationChunkKey(key, metadata.generation, index)
    : legacyChunkKey(key, index);
}

function defaultGeneration() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function removeChunks(
  storage: NativeKeyValueStore,
  key: string,
  metadata: NativeSessionMetadata | null,
) {
  if (!metadata) return;

  await Promise.all(
    Array.from({ length: metadata.chunks }, (_, index) =>
      storage.deleteItemAsync(chunkKey(key, metadata, index)),
    ),
  );
}

/**
 * Stores an Auth session in SecureStore-sized pieces without ever overwriting the
 * currently committed pieces. The metadata entry is the commit marker: it changes
 * only after every piece of the replacement session has been written successfully.
 */
export function createChunkedSessionStorage(
  storage: NativeKeyValueStore,
  {
    chunkSize,
    createGeneration = defaultGeneration,
  }: ChunkedSessionStorageOptions,
) {
  return {
    getItem: async (key: string) => {
      const metadata = parseMetadata(
        await storage.getItemAsync(metadataKey(key)),
      );
      if (metadata) {
        const chunks = await Promise.all(
          Array.from({ length: metadata.chunks }, (_, index) =>
            storage.getItemAsync(chunkKey(key, metadata, index)),
          ),
        );

        if (
          chunks.every((chunk): chunk is string => typeof chunk === "string")
        ) {
          return chunks.join("");
        }
      }

      // Compatibility with sessions saved before chunked storage was introduced.
      return storage.getItemAsync(key);
    },
    setItem: async (key: string, value: string) => {
      const previousMetadata = parseMetadata(
        await storage.getItemAsync(metadataKey(key)),
      );
      const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, "g")) ?? [""];
      const nextMetadata: NativeSessionMetadata = {
        chunks: chunks.length,
        generation: createGeneration(),
      };

      // Write to a fresh generation first. If the app is interrupted here, the
      // previous metadata still points to a complete, usable session.
      await Promise.all(
        chunks.map((chunk, index) =>
          storage.setItemAsync(chunkKey(key, nextMetadata, index), chunk),
        ),
      );

      // Publishing metadata is the atomic commit point for the replacement session.
      await storage.setItemAsync(
        metadataKey(key),
        JSON.stringify(nextMetadata),
      );
      await storage.deleteItemAsync(key);

      // The replacement is committed, so stale chunks can no longer affect reads.
      await removeChunks(storage, key, previousMetadata);
    },
    removeItem: async (key: string) => {
      const metadata = parseMetadata(
        await storage.getItemAsync(metadataKey(key)),
      );
      await Promise.all([
        storage.deleteItemAsync(key),
        storage.deleteItemAsync(metadataKey(key)),
        removeChunks(storage, key, metadata),
      ]);
    },
  };
}
