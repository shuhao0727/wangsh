import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIAgentsPage from "./index";
import type { AgentSidebarProps, ChatAreaProps } from "./types";
import { agentDataApi } from "@services/agents";
import { showMessage } from "@/lib/toast";

const boundary = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: { id: 7 } as { id: number } | null, isLoading: false,
    isStudent: () => true, isAdmin: () => false, getDisplayName: () => "synthetic",
    getToken: () => "synthetic-not-a-credential" },
  start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(),
}));
vi.mock("@hooks/useAuth", () => ({ default: () => boundary.auth }));
vi.mock("@hooks/useAdminSSE", () => ({ useAdminSSE: () => undefined }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => ({ md: true }) }));
vi.mock("./hooks/useStreamEngine", () => ({ useStreamEngine: () => ({ startStream: boundary.start, stopStream: boundary.stop }) }));
vi.mock("@services", () => ({ config: { apiUrl: "/synthetic-api" } }));
vi.mock("@services/logger", () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@services/agents", () => ({
  aiAgentsApi: { getActiveAgents: vi.fn(async () => ({ data: [
    { id: 1, agent_name: "One", status: true }, { id: 2, agent_name: "Two", status: true },
  ] })) },
  agentDataApi: { listConversations: vi.fn(), getConversationMessages: vi.fn(), createUsage: vi.fn().mockResolvedValue({success:true}), saveConversation: vi.fn() },
}));
vi.mock("./GroupDiscussionPanel", () => ({ default: () => null }));
vi.mock("./AssessmentPanel", () => ({ default: () => null }));
vi.mock("./ClassroomPanel", () => ({ default: () => null }));
// Render the real page and original handlers. Child views expose state/controls;
// only service boundaries are asynchronous doubles, never copied handlers.
vi.mock("./AgentSidebar", () => ({ default: (p: AgentSidebarProps) => <aside>
  <output data-testid="selection">{p.currentSessionId}</output>
  <output data-testid="agent">{p.currentAgent?.id}</output>
  <button onClick={p.onStartNewConversation}>new</button>
  {p.agents.map(a => <button key={a.id} onClick={() => p.onAgentChange(a.id)}>agent-{a.id}</button>)}
  {p.sessions.map(s => <button key={s.session_id} onClick={() => p.onSelectSession(s.session_id)}>session-{s.session_id}</button>)}
</aside> }));
vi.mock("./ChatArea", () => ({ default: (p: ChatAreaProps) => <section>
  <output data-testid="messages">{JSON.stringify(p.messages)}</output>
  <input aria-label="message" value={p.inputMessage} onChange={e => p.onInputChange(e.target.value)} />
  <button onClick={() => p.onSendMessage()}>send</button>
</section> }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
type List = Awaited<ReturnType<typeof agentDataApi.listConversations>>;
type Messages = Awaited<ReturnType<typeof agentDataApi.getConversationMessages>>;
const list = (ids = ["A", "B"], agent: number | null = 1): List => ({ success: true, message: "ok", data: ids.map(session_id => ({ session_id, agent_id: agent, display_agent_name: agent === null ? null : "Synthetic", last_at: new Date().toISOString(), turns: 1 })) });
const messages = (id: string, agent = 1): Messages => ({ success: true, message: "ok", data: [{ id: 1, session_id: id, agent_id: agent, content: `history-${id}`, message_type: "question", created_at: new Date().toISOString() }] });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const text = () => screen.getByTestId("messages").textContent;
const settle = async (fn: () => void) => { await act(async () => { fn(); }); };
const mount = async () => { const view = render(<AIAgentsPage />); await act(async () => {}); return view; };
const send = () => { fireEvent.change(screen.getByLabelText("message"), { target: { value: "next" } }); click("send"); };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  boundary.auth = { ...boundary.auth, isAuthenticated: true, user: { id: 7 } };
  vi.mocked(agentDataApi.listConversations).mockReset().mockResolvedValue(list());
  vi.mocked(agentDataApi.getConversationMessages).mockReset().mockImplementation(async id => messages(id));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("FE-01 real page history ownership", () => {
  it("ordered control restores preferred session and sends only its context", async () => {
    localStorage.setItem("znt:chat:last_session:7:1", "B");
    await mount(); expect(text()).toContain("history-B");
    expect(screen.getByTestId("selection")).toHaveTextContent("B");
    send(); expect(boundary.start).toHaveBeenCalledOnce();
    expect(boundary.start.mock.calls[0][0].body.messages).toEqual([{ role: "user", content: "history-B" }, { role: "user", content: "next" }]);
  });
  it.each(["older-first", "newer-first"])("keeps B selected and displayed when %s resolves", async order => {
    await mount(); const a = deferred<Messages>(), b = deferred<Messages>();
    vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    click("session-A"); click("session-B");
    expect(text()).not.toContain("history-A");
    if (order === "older-first") { await settle(() => a.resolve(messages("A"))); expect(text()).not.toContain("history-A"); await settle(() => b.resolve(messages("B"))); }
    else { await settle(() => b.resolve(messages("B"))); await settle(() => a.resolve(messages("A"))); }
    expect(screen.getByTestId("selection")).toHaveTextContent("B"); expect(text()).toContain("history-B"); expect(text()).not.toContain("history-A");
    expect(localStorage.getItem("znt:chat:last_session:7:1")).toBe("B");
    send(); expect(boundary.start.mock.calls[0][0].body.messages[0].content).toBe("history-B");
  });
  it("does not send while history is pending, then sends the loaded context", async () => {
    await mount(); const b = deferred<Messages>(); vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(b.promise);
    click("session-B"); send(); expect(boundary.start).not.toHaveBeenCalled();
    await settle(() => b.resolve(messages("B"))); send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("new conversation invalidates a pending manual detail", async () => {
    await mount(); const b = deferred<Messages>(); vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(b.promise);
    click("session-B"); click("new"); const id = screen.getByTestId("selection").textContent;
    await settle(() => b.resolve(messages("B")));
    expect(text()).not.toContain("history-B"); expect(screen.getByTestId("selection").textContent).toBe(id);
    expect(localStorage.getItem("znt:chat:last_session:7:1")).toBe(id);
  });
  it("new conversation invalidates a pending restore list before details/storage", async () => {
    const pending = deferred<List>(); vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(pending.promise);
    await mount(); click("new"); const id = screen.getByTestId("selection").textContent;
    await settle(() => pending.resolve(list()));
    expect(agentDataApi.getConversationMessages).not.toHaveBeenCalled();
    expect(screen.getByTestId("selection").textContent).toBe(id);
  });
  it("manual selection supersedes an automatic restore detail", async () => {
    const a = deferred<Messages>(); vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(a.promise);
    await mount(); click("session-B"); await act(async () => {});
    await settle(() => a.resolve(messages("A"))); expect(text()).toContain("history-B"); expect(text()).not.toContain("history-A");
  });
  it.each(["list", "detail"])("agent switch invalidates pending %s", async phase => {
    const oldList = deferred<List>(), oldDetail = deferred<Messages>();
    if (phase === "list") vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(oldList.promise);
    else vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(oldDetail.promise);
    await mount(); vi.mocked(agentDataApi.listConversations).mockResolvedValue(list(["C"], 2));
    vi.mocked(agentDataApi.getConversationMessages).mockResolvedValue(messages("C", 2));
    click("agent-2"); await act(async () => {});
    await settle(() => phase === "list" ? oldList.resolve(list()) : oldDetail.resolve(messages("A")));
    expect(text()).toContain("history-C"); expect(text()).not.toContain("history-A");
    expect(screen.queryByRole("button", { name: "session-A" })).not.toBeInTheDocument();
  });
  it("identity change invalidates a pending restore list", async () => {
    const old = deferred<List>(); vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(old.promise);
    const view = await mount(); vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce(list(["U8"]));
    boundary.auth = { ...boundary.auth, user: { id: 8 } }; view.rerender(<AIAgentsPage />);
    await act(async () => {}); await settle(() => old.resolve(list()));
    expect(text()).toContain("history-U8"); expect(text()).not.toContain("history-A");
    expect(screen.queryByRole("button", { name: "session-A" })).not.toBeInTheDocument();
  });
  it("same-mounted identity change clears old messages immediately and restores only new user", async () => {
    const view = await mount(); const old = deferred<Messages>(), next = deferred<List>();
    vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(old.promise); click("session-B");
    vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(next.promise);
    boundary.auth = { ...boundary.auth, user: { id: 8 } }; view.rerender(<AIAgentsPage />);
    expect(text()).not.toContain("history-A"); expect(screen.queryByRole("button", { name: "session-A" })).not.toBeInTheDocument();
    await settle(() => old.resolve(messages("B"))); expect(text()).not.toContain("history-B");
    await settle(() => next.resolve(list(["U8"]))); expect(text()).toContain("history-U8");
    expect(localStorage.getItem("znt:chat:last_session:7:1")).toBe("B");
  });
  it("logout invalidates a pending detail", async () => {
    const view = await mount(); const pending = deferred<Messages>(); vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(pending.promise); click("session-B");
    boundary.auth = { ...boundary.auth, isAuthenticated: false }; view.rerender(<AIAgentsPage />);
    await settle(() => pending.resolve(messages("B"))); expect(text()).toBe("[]");
  });
  it.each(["list", "detail"])("unmount invalidates pending %s without errors or downstream work", async phase => {
    const a = deferred<List>(), b = deferred<Messages>();
    if (phase === "list") vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(a.promise);
    else vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(b.promise);
    const view = await mount(); view.unmount();
    await settle(() => phase === "list" ? a.resolve(list([])) : b.reject(new Error("late")));
    expect(localStorage.length).toBe(0); expect(showMessage.error).not.toHaveBeenCalled();
    if (phase === "list") expect(agentDataApi.getConversationMessages).not.toHaveBeenCalled();
  });
  it.each(["rejection", "unsuccessful"])("current detail %s clears old context, reports failure, blocks send, allows retry", async failure => {
    await mount();
    if (failure === "rejection") vi.mocked(agentDataApi.getConversationMessages).mockRejectedValueOnce(new Error("synthetic failure"));
    else vi.mocked(agentDataApi.getConversationMessages).mockResolvedValueOnce({ success: false, data: [], message: "failure" });
    click("session-B"); await act(async () => {});
    expect(text()).not.toContain("history-A"); expect(showMessage.error).toHaveBeenCalledOnce();
    send(); expect(boundary.start).not.toHaveBeenCalled();
    click("session-B"); await act(async () => {}); expect(text()).toContain("history-B"); send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("stale rejection cannot display an error or unlock a newer pending request", async () => {
    await mount(); const a = deferred<Messages>(), b = deferred<Messages>();
    vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    click("session-A"); click("session-B"); await settle(() => a.reject(new Error("stale")));
    expect(showMessage.error).not.toHaveBeenCalled(); send(); expect(boundary.start).not.toHaveBeenCalled();
    await settle(() => b.resolve(messages("B"))); expect(text()).toContain("history-B");
  });
  it.each(["rejection", "unsuccessful"])("restore list %s is handled and new conversation recovers", async failure => {
    if (failure === "rejection") vi.mocked(agentDataApi.listConversations).mockRejectedValueOnce(new Error("list failure"));
    else vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce({ success: false, data: [], message: "failure" });
    await mount(); expect(showMessage.error).toHaveBeenCalledOnce(); send(); expect(boundary.start).not.toHaveBeenCalled();
    click("new"); send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("empty list starts a new conversation", async () => {
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce(list([])); await mount();
    expect(screen.getByTestId("selection").textContent).toBeTruthy(); expect(text()).toContain("你好");
    send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("empty detail remains sendable", async () => {
    vi.mocked(agentDataApi.getConversationMessages).mockResolvedValueOnce({ success: true, message: "ok", data: [] });
    await mount(); expect(screen.getByTestId("selection")).toHaveTextContent("A");
    send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it.each(["rejection", "unsuccessful"])("restore detail %s blocks send until retry", async failure => {
    if (failure === "rejection") vi.mocked(agentDataApi.getConversationMessages).mockRejectedValueOnce(new Error("detail failure"));
    else vi.mocked(agentDataApi.getConversationMessages).mockResolvedValueOnce({ success: false, message: "failure", data: [] });
    await mount(); expect(showMessage.error).toHaveBeenCalledOnce(); send(); expect(boundary.start).not.toHaveBeenCalled();
    click("session-A"); await act(async () => {}); send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("new conversation invalidates pending automatic detail", async () => {
    const pending = deferred<Messages>(); vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(pending.promise);
    await mount(); click("new"); const id = screen.getByTestId("selection").textContent;
    await settle(() => pending.resolve(messages("A")));
    expect(screen.getByTestId("selection").textContent).toBe(id); expect(text()).not.toContain("history-A");
    send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("authenticated user-null never reads guest history, persists a session, or sends", async () => {
    boundary.auth = { ...boundary.auth, user: null };
    localStorage.setItem("znt:chat:last_session:guest:1", "orphan");
    await mount(); click("new"); send();
    expect(agentDataApi.listConversations).not.toHaveBeenCalled();
    expect(agentDataApi.getConversationMessages).not.toHaveBeenCalled();
    expect(boundary.start).not.toHaveBeenCalled();
    expect(localStorage.getItem("znt:chat:last_session:guest:1")).toBe("orphan");
    expect(screen.getByTestId("selection").textContent).toBe("");
  });
  it("same-mounted user-null gap invalidates old detail and only resumes for the next user", async () => {
    const view = await mount(); const old = deferred<Messages>();
    vi.mocked(agentDataApi.getConversationMessages).mockReturnValueOnce(old.promise); click("session-B");
    vi.mocked(agentDataApi.listConversations).mockClear();
    boundary.auth = { ...boundary.auth, user: null }; view.rerender(<AIAgentsPage />); await act(async () => {});
    await settle(() => old.resolve(messages("B"))); click("new"); send();
    expect(text()).not.toContain("history-B"); expect(text()).not.toContain("history-A");
    expect(agentDataApi.listConversations).not.toHaveBeenCalled(); expect(boundary.start).not.toHaveBeenCalled();
    expect(localStorage.getItem("znt:chat:last_session:guest:1")).toBeNull();
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce(list(["U8"]));
    boundary.auth = { ...boundary.auth, user: { id: 8 } }; view.rerender(<AIAgentsPage />); await act(async () => {});
    expect(text()).toContain("history-U8"); send(); expect(boundary.start).toHaveBeenCalledOnce();
  });
  it("same-component agent switch immediately blocks send, then sends only the new agent context", async () => {
    await mount(); const next = deferred<List>();
    vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(next.promise);
    vi.mocked(agentDataApi.getConversationMessages).mockResolvedValue(messages("C", 2));
    click("agent-2"); send(); expect(boundary.start).not.toHaveBeenCalled(); expect(text()).not.toContain("history-A");
    await settle(() => next.resolve(list(["C"], 2))); send();
    expect(boundary.start).toHaveBeenCalledOnce();
    expect(boundary.start.mock.calls[0][0].body.messages).toEqual([{ role: "user", content: "history-C" }, { role: "user", content: "next" }]);
    expect(boundary.start.mock.calls[0][0].body.agent_id).toBe(2);
    expect(screen.getByTestId("selection")).toHaveTextContent("C");
  });
  it("all null/foreign summaries create a fresh current-agent session without adopting orphan history", async () => {
    localStorage.setItem("znt:chat:last_session:7:1", "orphan");
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce({ ...list(), data: [...list(["orphan"], null).data, ...list(["foreign"], 2).data] });
    await mount(); expect(agentDataApi.getConversationMessages).not.toHaveBeenCalled();
    const id = screen.getByTestId("selection").textContent; expect(id).toBeTruthy(); expect(id).not.toBe("orphan"); expect(id).not.toBe("foreign");
    send(); expect(boundary.start).toHaveBeenCalledOnce();
    expect(screen.getByTestId("selection").textContent).toBe(id);
    expect(JSON.stringify(boundary.start.mock.calls[0][0].body.messages)).not.toMatch(/orphan|foreign/);
    expect(boundary.start.mock.calls[0][0].body.messages.at(-1)).toEqual({ role: "user", content: "next" });
  });
  it("a late stream completion in a user-null gap cannot repopulate or persist the old history", async () => {
    const view = await mount(); send(); const callbacks = boundary.start.mock.calls[0][0].callbacks;
    boundary.auth = { ...boundary.auth, user: null }; view.rerender(<AIAgentsPage />);
    await settle(() => { callbacks.onDelta("late delta"); callbacks.onEnd("late answer"); });
    expect(text()).not.toContain("late answer"); expect(text()).not.toContain("history-A");
    expect(agentDataApi.createUsage).not.toHaveBeenCalled();
  });
  it.each(["timer", "response"])("send-completion history refresh is invalidated at %s by agent switch", async phase => {
    vi.useFakeTimers(); await mount(); send();
    await settle(() => boundary.start.mock.calls[0][0].callbacks.onEnd("answer-A"));
    const refresh = deferred<List>();
    if (phase === "response") {
      vi.mocked(agentDataApi.listConversations).mockReturnValueOnce(refresh.promise);
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }
    vi.mocked(agentDataApi.listConversations).mockResolvedValue(list(["C"], 2));
    vi.mocked(agentDataApi.getConversationMessages).mockResolvedValue(messages("C", 2));
    click("agent-2"); await act(async () => {});
    const count = vi.mocked(agentDataApi.listConversations).mock.calls.length;
    if (phase === "timer") { await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); expect(agentDataApi.listConversations).toHaveBeenCalledTimes(count); }
    else await settle(() => refresh.resolve(list()));
    expect(screen.queryByRole("button", { name: "session-A" })).not.toBeInTheDocument(); expect(text()).toContain("history-C");
  });
  it("current send-completion refresh keeps only resumable current-agent summaries", async () => {
    vi.useFakeTimers(); await mount(); send();
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce({ ...list(), data: [...list(["orphan"], null).data, ...list(["foreign"], 2).data, ...list(["fresh"]).data] });
    await settle(() => boundary.start.mock.calls[0][0].callbacks.onEnd("answer-A"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole("button", { name: "session-fresh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "session-orphan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "session-foreign" })).not.toBeInTheDocument();
    expect(text()).toContain("answer-A");
  });
  it("a refreshed active summary becoming mixed/null is read-only until a new conversation", async () => {
    vi.useFakeTimers(); await mount(); send();
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce(list(["A"], null));
    await settle(() => boundary.start.mock.calls[0][0].callbacks.onEnd("answer-A"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(text()).toContain("answer-A"); send(); expect(boundary.start).toHaveBeenCalledTimes(1);
    click("new"); send(); expect(boundary.start).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(boundary.start.mock.calls[1][0].body.messages)).not.toContain("history-A");
  });
  it("usage await rejecting after unmount does not schedule another history read", async () => {
    vi.useFakeTimers(); const view = await mount();
    const pending = deferred<Awaited<ReturnType<typeof agentDataApi.createUsage>>>();
    vi.mocked(agentDataApi.createUsage).mockReturnValueOnce(pending.promise);
    send(); await settle(() => boundary.start.mock.calls[0][0].callbacks.onEnd("answer-A"));
    const count = vi.mocked(agentDataApi.listConversations).mock.calls.length; view.unmount();
    await settle(() => pending.reject(new Error("synthetic save failure")));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(agentDataApi.listConversations).toHaveBeenCalledTimes(count); expect(showMessage.error).not.toHaveBeenCalled();
  });
  it("does not restore unowned/null-agent history into the current agent", async () => {
    vi.mocked(agentDataApi.listConversations).mockResolvedValueOnce({ ...list(), data: [...list(["orphan"], null).data, ...list(["foreign"], 2).data, ...list(["B"]).data] });
    localStorage.setItem("znt:chat:last_session:7:1", "orphan");
    await mount(); expect(text()).toContain("history-B"); expect(agentDataApi.getConversationMessages).toHaveBeenCalledWith("B");
    send(); expect(boundary.start.mock.calls[0][0].body.messages[0].content).toBe("history-B");
    expect(screen.queryByRole("button", { name: "session-orphan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "session-foreign" })).not.toBeInTheDocument();
  });
});
