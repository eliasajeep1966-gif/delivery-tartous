import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type OfficeDistributionException = {
  id: string;
  keyword: string;
  captain: string;
  office: string;
};

export type OfficeSettings = {
  name: string;
  phone: string;
  address: string;
  captainShare: string;
  officeShare: string;
  exceptions: OfficeDistributionException[];
  updatedAt: string | null;
};

export type OfficeSettingsUpdate = Omit<OfficeSettings, "updatedAt">;

type JsonRecord = Record<string, unknown>;

const defaults: OfficeSettings = {
  name: "دليفري طرطوس",
  phone: "",
  address: "",
  captainShare: "70",
  officeShare: "30",
  exceptions: [],
  updatedAt: null,
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decimalText(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function mapExceptions(value: unknown): OfficeDistributionException[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const item = asRecord(entry);
    const keyword = item ? text(item.keyword).trim() : "";
    const captain = item ? decimalText(item.captain, "") : "";
    const office = item ? decimalText(item.office, "") : "";
    if (!keyword || !captain || !office) return [];
    return [{
      id: text(item?.id) || `saved-${index}`,
      keyword,
      captain,
      office,
    }];
  });
}

function mapOfficeSettings(value: unknown): OfficeSettings | null {
  const record = asRecord(Array.isArray(value) ? value[0] : value);
  if (!record) return null;
  return {
    name: text(record.office_name) || defaults.name,
    phone: text(record.office_phone),
    address: text(record.office_address),
    captainShare: decimalText(record.captain_share, defaults.captainShare),
    officeShare: decimalText(record.office_share, defaults.officeShare),
    exceptions: mapExceptions(record.distribution_exceptions),
    updatedAt: text(record.updated_at) || null,
  };
}

async function loadOfficeSettings(): Promise<OfficeSettings> {
  const { data, error } = await getNativeSupabaseClient().rpc(
    "get_office_settings",
  );
  if (error) throw new Error(error.message);
  const settings = mapOfficeSettings(data);
  if (!settings) throw new Error("تعذر تحميل إعدادات المكتب.");
  return settings;
}

async function saveOfficeSettings(
  settings: OfficeSettingsUpdate,
): Promise<OfficeSettings> {
  const { data, error } = await getNativeSupabaseClient().rpc(
    "update_office_settings",
    {
      p_office_name: settings.name.trim(),
      p_office_phone: settings.phone.trim(),
      p_office_address: settings.address.trim(),
      p_captain_share: Number(settings.captainShare),
      p_office_share: Number(settings.officeShare),
      p_distribution_exceptions: settings.exceptions.map((item) => ({
        id: item.id,
        keyword: item.keyword.trim(),
        captain: Number(item.captain),
        office: Number(item.office),
      })),
    },
  );
  if (error) throw new Error(error.message);
  const saved = mapOfficeSettings(data);
  if (!saved) throw new Error("تعذر تأكيد حفظ إعدادات المكتب.");
  return saved;
}

export function useOfficeSettings(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["office-settings"],
    queryFn: loadOfficeSettings,
    enabled,
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: saveOfficeSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(["office-settings"], saved);
    },
  });

  return {
    ...query,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
