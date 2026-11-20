import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { groupDiscussionApi } from "@services/agents";
import { showMessage } from "@/lib/toast";
import type { GroupDiscussionMessage } from "@services/znt/api/group-discussion-api";
import GroupDiscussionPanel from "./GroupDiscussionPanel";

vi.mock("@services/agents", () => ({ groupDiscussionApi: {
  getPublicConfig: vi.fn(), listGroups: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn(), join: vi.fn(),
} }));
vi.mock("@services", () => ({ config: { apiUrl: "/synthetic-api" }, userApi: {} }));
vi.mock("@services/api", () => ({ getStoredAccessToken: () => null }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

class TestEventSource extends EventTarget {
  static latest: TestEventSource;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(readonly url: string) {
    super();
    TestEventSource.latest = this;
  }
}

const listMessages = vi.mocked(groupDiscussionApi.listMessages);
const row = (id: number): GroupDiscussionMessage => ({
  id, session_id: 1, user_id: 9, user_display_name: "同组成员",
  content: `讨论消息 ${id}`, created_at: "2026-11-18T08:00:00Z",
});
const page = (items: GroupDiscussionMessage[], next_after_id: number) => ({
  success: true, message: "", data: { items, next_after_id },
});
const click = (name: string) => act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
const deliver = (items: GroupDiscussionMessage[], next_after_id: number) => act(async () => {
  TestEventSource.latest.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ items, next_after_id }) }));
});
const displayedMessages = () => screen.getAllByText(/^讨论消息 /).map(node => node.textContent);

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.setItem("gd_session_id", "1");
  localStorage.setItem("gd_group_no", "1");
  vi.stubGlobal("EventSource", TestEventSource);
  vi.mocked(groupDiscussionApi.getPublicConfig).mockResolvedValue({
    success: true, message: "", data: { enabled: true, join_lock_seconds: 180, rate_limit_seconds: 5 },
  });
  vi.mocked(groupDiscussionApi.listGroups).mockResolvedValue({ success: true, message: "", data: { items: [] } });
  await act(async () => {
    render(<TooltipProvider><GroupDiscussionPanel isAuthenticated isStudent isAdmin={false} userId={7} /></TooltipProvider>);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("reopens a quiet group at the last SSE cursor and merges overlapping REST and stream messages", async () => {
  const rows = Array.from({ length: 235 }, (_, index) => row(30 + index * 2));
  listMessages.mockImplementation(async ({ afterId = 0, limit = 50 }) => {
    const items = rows.filter(message => message.id > afterId).slice(0, limit);
    return page(items, items.at(-1)?.id ?? afterId);
  });
  await click("小组讨论");
  await deliver([row(10), row(20)], 20);
  expect(displayedMessages()).toEqual(["讨论消息 10", "讨论消息 20"]);
  const firstStream = TestEventSource.latest;
  await click("关闭窗口");
  expect(firstStream.close).toHaveBeenCalledOnce();

  await click("小组讨论");
  expect(TestEventSource.latest.url).toContain("after_id=20");
  expect(listMessages).not.toHaveBeenCalled();
  await click("刷新");
  expect(displayedMessages()).toHaveLength(237);
  expect(listMessages.mock.calls.map(([request]) => request.afterId)).toEqual([20, 428]);

  await deliver(rows.slice(0, 200), 428);
  await deliver([...rows.slice(200), row(500)], 500);
  expect(displayedMessages()).toEqual([row(10), row(20), ...rows, row(500)].map(message => message.content));
  await click("关闭窗口");
  await click("小组讨论");
  expect(TestEventSource.latest.url).toContain("after_id=500");
});

it("exits a removed group when the next fallback cursor page loses access", async () => {
  const items = Array.from({ length: 200 }, (_, index) => row(index + 1));
  listMessages.mockResolvedValueOnce(page(items, 200)).mockResolvedValueOnce({
    success: false, forbidden: true, message: "已移出", data: { items: [], next_after_id: 200 },
  });
  await click("小组讨论");
  await act(async () => { TestEventSource.latest.onerror?.(); });
  expect(listMessages.mock.calls.map(([request]) => request.afterId)).toEqual([0, 200]);
  expect(screen.queryByText("讨论消息 1")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "加入小组" })).toBeInTheDocument();
  expect(showMessage.warning).toHaveBeenCalledWith("你已不在该讨论组");
  expect(TestEventSource.latest.close).toHaveBeenCalledOnce();
});

it("backs off on a transient fallback failure, resets the delay after a read, and stops on 404", async () => {
  vi.useFakeTimers();
  const empty = { items: [], next_after_id: 0 };
  listMessages.mockResolvedValueOnce({ success: false, message: "暂时不可用", data: empty })
    .mockResolvedValueOnce(page([], 0))
    .mockResolvedValueOnce({ success: false, missing: true, message: "已删除", data: empty });
  await click("小组讨论");
  await act(async () => { TestEventSource.latest.onerror?.(); });
  expect(listMessages).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(5999); });
  expect(listMessages).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(listMessages).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(listMessages).toHaveBeenCalledTimes(3);
  expect(showMessage.warning).toHaveBeenCalledWith("讨论组已被删除");
  expect(screen.getByRole("button", { name: "加入小组" })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(listMessages).toHaveBeenCalledTimes(3);
});

it("ignores the old group's send response after changing groups", async () => {
  let finishSend!: (res: Awaited<ReturnType<typeof groupDiscussionApi.sendMessage>>) => void;
  vi.mocked(groupDiscussionApi.sendMessage).mockReturnValueOnce(new Promise(resolve => { finishSend = resolve; }));
  vi.mocked(groupDiscussionApi.listGroups).mockResolvedValue({ success: true, message: "", data: { items: [{
    session_id: 2, group_no: "2", session_date: "2026-11-18", class_name: "测试班", message_count: 0, member_count: 1,
  }] } });
  vi.mocked(groupDiscussionApi.join).mockResolvedValueOnce({ success: true, message: "", data: {
    session_id: 2, group_no: "2", session_date: "2026-11-18", class_name: "测试班", display_name: "学生", group_lock_seconds: 0,
  } });

  await click("小组讨论");
  fireEvent.change(screen.getByPlaceholderText("输入消息..."), { target: { value: "旧组私有消息" } });
  await click("发送");
  expect(groupDiscussionApi.sendMessage).toHaveBeenCalledWith({ sessionId: 1, content: "旧组私有消息" });
  await click("切换小组");
  await click("加入");
  fireEvent.change(screen.getByPlaceholderText("输入消息..."), { target: { value: "新组草稿" } });
  await act(async () => finishSend({ success: true, message: "", data: { ...row(100), content: "旧组私有消息", user_id: 7 } }));

  expect(screen.queryByText("旧组私有消息")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("输入消息...")).toHaveValue("新组草稿");
});
