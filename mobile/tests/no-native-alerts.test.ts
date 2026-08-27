import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("native alert removal", () => {
  it("uses in-app toasts and confirmation dialogs instead of React Native Alert", () => {
    const files = [
      ...sourceFiles(resolve(__dirname, "../app")),
      ...sourceFiles(resolve(__dirname, "../components")),
    ];

    for (const path of files) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/\bAlert\b|Alert\.alert/);
    }
  });
});
