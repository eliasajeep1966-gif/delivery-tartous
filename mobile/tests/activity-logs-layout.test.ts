import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../app/activity-logs.tsx"),
  "utf8",
);

describe("activity logs layout", () => {
  it("uses a virtualized list while retaining the activity log data contract", () => {
    expect(source).toContain("useNativeActivityLogs");
    expect(source).toContain("<FlatList");
    expect(source).toContain("data={activities}");
    expect(source).not.toContain("activities.map(");
  });

  it("keeps search, category filters, loading, error, empty, and pagination states", () => {
    expect(source).toContain("onQueryChange={setQuery}");
    expect(source).toContain("onFilterChange={setFilter}");
    expect(source).toContain("<LoadingState />");
    expect(source).toContain("<ErrorState");
    expect(source).toContain("<EmptyState");
    expect(source).toContain("<Pagination");
    expect(source).toContain("data.nextPage()");
    expect(source).toContain("data.previousPage()");
  });

  it("uses the shared Delivery Tartous visual language for the screen and activity cards", () => {
    expect(source).toContain('className="bg-[#F4F7FB]"');
    expect(source).toContain('const BLUE = "#0878D1"');
    expect(source).toContain('const DEEP_BLUE = "#063B78"');
    expect(source).toContain('fontFamily: "Cairo_700Bold"');
    expect(source).toContain("safeBottom");
  });
});
