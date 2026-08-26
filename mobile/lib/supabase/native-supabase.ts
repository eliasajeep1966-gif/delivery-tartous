import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type DeliveryRole = "admin" | "supervisor" | "captain";

export type DeliveryProfile = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: DeliveryRole;
  account_activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

const NATIVE_SESSION_CHUNK_SIZE = 900;
const NATIVE_SESSION_META_SUFFIX = ".meta";
const NATIVE_SESSION_CHUNK_SUFFIX = ".chunk.";

type NativeSessionMetadata = {
  chunks: number;
};

function nativeSessionMetaKey(key: string) {
  return `${key}${NATIVE_SESSION_META_SUFFIX}`;
}

function nativeSessionChunkKey(key: string, index: number) {
  return `${key}${NATIVE_SESSION_CHUNK_SUFFIX}${index}`;
}

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);

    const metadataValue = await SecureStore.getItemAsync(nativeSessionMetaKey(key));
    if (metadataValue) {
      try {
        const metadata = JSON.parse(metadataValue) as NativeSessionMetadata;
        if (Number.isInteger(metadata.chunks) && metadata.chunks > 0) {
          const chunks = await Promise.all(
            Array.from({ length: metadata.chunks }, (_, index) =>
              SecureStore.getItemAsync(nativeSessionChunkKey(key, index)),
            ),
          );
          if (chunks.every((chunk): chunk is string => typeof chunk === "string")) {
            return chunks.join("");
          }
        }
      } catch {
        // Fall through to the legacy single-value entry below.
      }
    }

    // Read sessions written by the previous storage implementation and migrate them on the next write.
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${NATIVE_SESSION_CHUNK_SIZE}}`, "g")) ?? [""];
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(nativeSessionChunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(
      nativeSessionMetaKey(key),
      JSON.stringify({ chunks: chunks.length } satisfies NativeSessionMetadata),
    );
    await SecureStore.deleteItemAsync(key);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }

    const metadataValue = await SecureStore.getItemAsync(nativeSessionMetaKey(key));
    let chunkCount = 0;
    try {
      const metadata = metadataValue ? (JSON.parse(metadataValue) as NativeSessionMetadata) : null;
      chunkCount = metadata && Number.isInteger(metadata.chunks) ? metadata.chunks : 0;
    } catch {
      chunkCount = 0;
    }

    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(nativeSessionMetaKey(key)),
      ...Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(nativeSessionChunkKey(key, index)),
      ),
    ]);
  },
};

let cachedClient: SupabaseClient | null = null;

function configurationValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getConfiguration() {
  const extra = Constants.expoConfig?.extra;
  const url = configurationValue(process.env.EXPO_PUBLIC_SUPABASE_URL) || configurationValue(extra?.supabaseUrl);
  const publishableKey = configurationValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || configurationValue(extra?.supabasePublishableKey);

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError(
      "لم يتم إعداد اتصال Supabase للتطبيق. راجع إعدادات التطبيق ثم أعد المحاولة.",
    );
  }

  return { url, publishableKey };
}

export function getNativeSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const { url, publishableKey } = getConfiguration();
    cachedClient = createClient(url, publishableKey, {
      auth: {
        lock: processLock,
        storage: authStorage,
        storageKey: "delivery-tartous.auth.session",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return cachedClient;
}

export function isSupabaseConfigurationError(error: unknown): error is SupabaseConfigurationError {
  return error instanceof SupabaseConfigurationError;
}
