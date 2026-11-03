import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminSSE } from "@hooks/useAdminSSE";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

describe("useAdminSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not open the admin stream when disabled", () => {
    renderHook(() => useAdminSSE("agent_changed", () => undefined, false));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("opens the admin stream for enabled callers", async () => {
    renderHook(() => useAdminSSE("agent_changed", () => undefined, true));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].url).toContain("/admin/stream");
  });

  it("closes the stream when disabled after being enabled", async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useAdminSSE("agent_changed", () => undefined, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const stream = MockEventSource.instances[0];
    rerender({ enabled: false });
    await waitFor(() => expect(stream.close).toHaveBeenCalled());
  });
});
