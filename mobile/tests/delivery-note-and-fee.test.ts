import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const newOrderModalPath = new URL(
  "../components/admin/admin-new-order-modal.tsx",
  import.meta.url,
);
const captainHomePath = new URL(
  "../components/captain/captain-home.tsx",
  import.meta.url,
);

describe("Delivery destination notes and captain fee", () => {
  it("keeps notes optional for both pickup and delivery locations", async () => {
    const source = await readFile(newOrderModalPath, "utf8");

    expect(source).toContain('placeholder={type === "pickup" ? "ملاحظات المصدر (اختياري)" : "ملاحظات وجهة التسليم (اختياري)"}');
    expect(source).toContain('note: location.note.trim() || undefined');
  });

  it("renders the order fee in the captain order cards", async () => {
    const source = await readFile(captainHomePath, "utf8");

    expect(source).toContain('<Text style={styles.feeLabel}>أجرة الطلب</Text>');
    expect(source).toContain('<Text style={styles.feeValue}>{money(current.fee)}</Text>');
    expect(source).toContain('<Text style={styles.feeValue}>{money(order.fee)}</Text>');
    expect(source).toContain('{stop?.note ? <Text style={styles.note}>{stop.note}</Text> : null}');
  });
});
