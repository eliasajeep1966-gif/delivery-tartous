import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let cachedClient: SupabaseClient | null = null;

function getConfiguration() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

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
