import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../components/admin/admin-company-pdf-reports.tsx"),
  "utf8",
);

describe("captain PDF report name", () => {
  it("uses the captain name in the report title that also becomes the PDF filename", () => {
    expect(source).toContain("title: `تقرير الكابتن — ${summary.captain_name}`");
    expect(source).toContain("subject: summary.captain_name");
  });
});
