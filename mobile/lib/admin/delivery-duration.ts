export type DeliveryDurationStatus = "received" | "in_delivery" | "completed";

export type DeliveryStatusEvent = {
  status: string;
  timestamp: string;
};

export type DeliveryTiming = {
  receivedAt: string;
  completedAt: string | null;
};

export type DeliveryDurationPresentation = {
  mode: "active" | "completed";
  label: string;
  receivedTime: string;
  completedTime: string | null;
};

const DAMASCUS_TIME_ZONE = "Asia/Damascus";

function timestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestEventBefore(
  events: readonly DeliveryStatusEvent[],
  status: "received" | "completed",
  limit: number,
): DeliveryStatusEvent | null {
  let result: DeliveryStatusEvent | null = null;
  let resultAt = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    if (event.status !== status) continue;
    const eventAt = timestamp(event.timestamp);
    if (eventAt === null || eventAt > limit || eventAt < resultAt) continue;
    result = event;
    resultAt = eventAt;
  }

  return result;
}

/**
 * Derives a delivery window from immutable status history. The function never
 * substitutes created_at or updated_at when a real receive/complete event is absent.
 */
export function deriveDeliveryTiming(
  status: DeliveryDurationStatus,
  statusAt: string,
  events: readonly DeliveryStatusEvent[],
): DeliveryTiming | null {
  const statusTimestamp = timestamp(statusAt);
  if (statusTimestamp === null) return null;

  const received = latestEventBefore(events, "received", statusTimestamp);
  if (!received) return null;

  if (status === "received" || status === "in_delivery") {
    return { receivedAt: received.timestamp, completedAt: null };
  }

  const completed = latestEventBefore(events, "completed", statusTimestamp);
  if (!completed) return null;

  const receivedTimestamp = timestamp(received.timestamp);
  const completedTimestamp = timestamp(completed.timestamp);
  if (
    receivedTimestamp === null ||
    completedTimestamp === null ||
    completedTimestamp < receivedTimestamp
  ) {
    return null;
  }

  return { receivedAt: received.timestamp, completedAt: completed.timestamp };
}

function arabicNumber(value: number): string {
  return new Intl.NumberFormat("ar-SY").format(value);
}

export function formatDeliveryDuration(
  start: string,
  end: string,
): string | null {
  const startTimestamp = timestamp(start);
  const endTimestamp = timestamp(end);
  if (
    startTimestamp === null ||
    endTimestamp === null ||
    endTimestamp < startTimestamp
  )
    return null;

  const totalMinutes = Math.floor((endTimestamp - startTimestamp) / 60_000);
  if (totalMinutes < 1) return "أقل من دقيقة";

  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const pieces = [
    days ? `${arabicNumber(days)} ي` : null,
    hours ? `${arabicNumber(hours)} س` : null,
    minutes ? `${arabicNumber(minutes)} د` : null,
  ].filter((piece): piece is string => Boolean(piece));

  return pieces.join(" ");
}

export function formatDeliveryClock(value: string): string | null {
  if (timestamp(value) === null) return null;

  try {
    return new Intl.DateTimeFormat("ar-SY", {
      timeZone: DAMASCUS_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function presentDeliveryTiming(
  timing: DeliveryTiming,
  now = Date.now(),
): DeliveryDurationPresentation | null {
  const receivedTime = formatDeliveryClock(timing.receivedAt);
  if (!receivedTime) return null;

  if (timing.completedAt) {
    const completedTime = formatDeliveryClock(timing.completedAt);
    const label = formatDeliveryDuration(timing.receivedAt, timing.completedAt);
    if (!completedTime || !label) return null;
    return { mode: "completed", label, receivedTime, completedTime };
  }

  const nowValue = new Date(now).toISOString();
  const label = formatDeliveryDuration(timing.receivedAt, nowValue);
  if (!label) return null;

  return {
    mode: "active",
    label: `منذ ${label}`,
    receivedTime,
    completedTime: null,
  };
}
