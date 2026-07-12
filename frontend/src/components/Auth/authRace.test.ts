import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthRequestGate, raceWithTimeout } from "@hooks/useAuth";

describe("raceWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels the active operation and ignores a late result after timeout", async () => {
    vi.useFakeTimers();
    let resolveLate!: (value: string) => void;
    const lateResult = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });
    const onTimeout = vi.fn();

    const resultPromise = raceWithTimeout(lateResult, 100, onTimeout);
    await vi.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toBeNull();
    expect(onTimeout).toHaveBeenCalledOnce();

    resolveLate("late-user");
    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toBeNull();
  });
});

describe("AuthRequestGate", () => {
  it("invalidates a pending login after logout cancels the auth flow", () => {
    const gate = new AuthRequestGate();
    const login = gate.begin();

    expect(gate.isCurrent(login)).toBe(true);

    gate.cancel();

    expect(login.signal.aborted).toBe(true);
    expect(gate.isCurrent(login)).toBe(false);
  });
});
