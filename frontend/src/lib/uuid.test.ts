import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

describe("createUuid", () => {
  it("uses the native UUID API when available", () => {
    const randomUUID = vi.fn(() => "12345678-1234-4234-8234-123456789abc");
    vi.stubGlobal("crypto", { randomUUID });
    expect(createUuid()).toBe("12345678-1234-4234-8234-123456789abc");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("generates a valid UUID v4 when HTTP hides randomUUID", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(0));
    vi.stubGlobal("crypto", { getRandomValues });
    expect(createUuid()).toBe("00000000-0000-4000-8000-000000000000");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("fails explicitly when no secure random source exists", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createUuid()).toThrow("Secure random values are unavailable");
  });
});
