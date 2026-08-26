import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createClient,
  processLock,
  type SupabaseClient,
} from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createChunkedSessionStorage } from "./chunked-session-storage";

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

// Expo SecureStore has a small per-value limit. A 900-byte chunk stays safely
// below that limit while the metadata commit marker keeps token rotation atomic.
const NATIVE_SESSION_CHUNK_SIZE = 900;
const nativeSessionStorage = createChunkedSessionStorage(SecureStore, {
  chunkSize: NATIVE_SESSION_CHUNK_SIZE,
});

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return nativeSessionStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }

    await nativeSessionStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }

    await nativeSessionStorage.removeItem(key);
  },
};

let cachedClient: SupabaseClient | null = null;

function configurationValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getConfiguration() {
  const extra = Constants.expoConfig?.extra;
  const url =
    configurationValue(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
    configurationValue(extra?.supabaseUrl);
  const publishableKey =
    configurationValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    configurationValue(extra?.supabasePublishableKey);

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

export function isSupabaseConfigurationError(
  error: unknown,
): error is SupabaseConfigurationError {
  return error instanceof SupabaseConfigurationError;
}
