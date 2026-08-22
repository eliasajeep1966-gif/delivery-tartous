import { describe, expect, it, vi } from "vitest";

import { AuthRequestTimeoutError, classifyAuthError, withAuthTimeout } from "../lib/auth/auth-errors";

describe("Native auth error classification", () => {
  it.each([
    [new AuthRequestTimeoutError(), "session", "timeout"],
    [new Error("Network request failed"), "session", "network"],
    [new Error("Invalid login credentials"), "sign-in", "credentials"],
    [new Error("Email not confirmed"), "sign-in", "account-pending"],
    [new Error("Too many requests"), "sign-in", "rate-limited"],
    [new Error("Invalid refresh token"), "profile", "session-invalid"],
  ] as const)("classifies %s", (error, context, expectedCode) => {
    expect(classifyAuthError(error, context).code).toBe(expectedCode);
  });

  it("keeps profile failures retryable without forcing logout", () => {
    const issue = classifyAuthError(new Error("RLS query failed"), "profile");
    expect(issue.code).toBe("unknown");
    expect(issue.recoverable).toBe(true);
  });

  it("keeps activation failures distinct from sign-in failures", () => {
    const issue = classifyAuthError(new Error("edge function rejected request"), "activation");
    expect(issue.title).toBe("تعذر تفعيل الحساب");
  });

  it("rejects a request after the configured timeout", async () => {
    vi.useFakeTimers();
    const pendingRequest = new Promise<never>(() => undefined);
    const result = withAuthTimeout(pendingRequest, 10);
    const assertion = expect(result).rejects.toBeInstanceOf(AuthRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    vi.useRealTimers();
  });
});
