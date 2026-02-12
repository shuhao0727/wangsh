import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Divider, Input, Select, Space, Spin, Typography, message } from "antd";
import { PushpinFilled, PushpinOutlined, TeamOutlined } from "@ant-design/icons";
import { groupDiscussionApi } from "@services/agents";
import { config } from "@services";

const { Text } = Typography;

const GROUP_NO_KEY = "ai_agents_discussion_group_no";
const CLASS_NAME_KEY = "ai_agents_discussion_class_name";
const GROUP_NAME_KEY = "ai_agents_discussion_group_name";
const GROUP_LOCK_UNTIL_KEY = "ai_agents_discussion_group_lock_until";
const GROUP_NAME_LOCK_UNTIL_KEY = "ai_agents_discussion_group_name_lock_until";
const FLOATING_POS_KEY = "ai_agents_discussion_floating_pos";
const FLOATING_SIZE_KEY = "ai_agents_discussion_floating_size";
const FLOATING_PINNED_KEY = "ai_agents_discussion_floating_pinned";

type Props = {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
};

const GroupDiscussionPanel: React.FC<Props> = ({ isAuthenticated, isStudent, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const [floatingPinned, setFloatingPinned] = useState<boolean>(() => {
    const raw = localStorage.getItem(FLOATING_PINNED_KEY);
    return raw === "1";
  });
  const [frontendEnabled, setFrontendEnabled] = useState(false);
  const [frontendEnabledChecked, setFrontendEnabledChecked] = useState(false);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>(() => {
    const raw = localStorage.getItem(FLOATING_POS_KEY);
    if (!raw) return { x: 16, y: 120 };
    try {
      const v = JSON.parse(raw) as any;
      const x = Number(v?.x);
      const y = Number(v?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 16, y: 120 };
      return { x, y };
    } catch {
      return { x: 16, y: 120 };
    }
  });
  const [floatingSize, setFloatingSize] = useState<{ w: number; h: number }>(() => {
    const raw = localStorage.getItem(FLOATING_SIZE_KEY);
    if (!raw) return { w: 420, h: 420 };
    try {
      const v = JSON.parse(raw) as any;
      const w = Number(v?.w);
      const h = Number(v?.h);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return { w: 420, h: 420 };
      return { w: Math.max(320, Math.min(680, w)), h: Math.max(260, Math.min(720, h)) };
    } catch {
      return { w: 420, h: 420 };
    }
  });
  const draggingRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);

  const [groupNo, setGroupNo] = useState<string>(() => localStorage.getItem(GROUP_NO_KEY) || "");
  const [className, setClassName] = useState<string>(() => localStorage.getItem(CLASS_NAME_KEY) || "");
  const [groupName, setGroupName] = useState<string>(() => localStorage.getItem(GROUP_NAME_KEY) || "");
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [groupLockedUntil, setGroupLockedUntil] = useState<number>(() => {
    const raw = localStorage.getItem(GROUP_LOCK_UNTIL_KEY);
    const v = raw ? Number(raw) : 0;
    return Number.isFinite(v) ? v : 0;
  });
  const [groupNameLockedUntil, setGroupNameLockedUntil] = useState<number>(() => {
    const raw = localStorage.getItem(GROUP_NAME_LOCK_UNTIL_KEY);
    const v = raw ? Number(raw) : 0;
    return Number.isFinite(v) ? v : 0;
  });

  const [messagesList, setMessagesList] = useState<
    Array<{
      id: number;
      user_display_name: string;
      content: string;
      created_at: string;
    }>
  >([]);
  const [afterId, setAfterId] = useState(0);
  const afterIdRef = useRef(0);
  const [polling, setPolling] = useState(false);
  const [sending, setSending] = useState(false);

  const [draft, setDraft] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  const listRef = useRef<HTMLDivElement | null>(null);
  const cooldownUntilRef = useRef(0);
  const sendingRef = useRef(false);
  useEffect(() => {
    afterIdRef.current = afterId;
  }, [afterId]);

  useEffect(() => {
    cooldownUntilRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(() => {
    if (!open) return;
    if (!isAuthenticated || (!isStudent && !isAdmin)) {
      setSessionId(null);
      setAfterId(0);
      setMessagesList([]);
    }
  }, [isAuthenticated, isStudent, isAdmin, open]);

  const unreadCount = 0;
  const canUse = isAuthenticated && (isStudent || isAdmin);

  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupKeyword, setGroupKeyword] = useState("");
  const [availableGroups, setAvailableGroups] = useState<
    Array<{
      session_id: number;
      session_date: string;
      class_name: string;
      group_no: string;
      group_name?: string | null;
      message_count: number;
      last_message_at?: string | null;
    }>
  >([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const lockMs = useMemo(() => Math.max(0, groupLockedUntil - nowTs), [groupLockedUntil, nowTs]);
  const groupLocked = lockMs > 0;

  const groupNameLockMs = useMemo(
    () => Math.max(0, groupNameLockedUntil - nowTs),
    [groupNameLockedUntil, nowTs],
  );
  const groupNameLocked = groupNameLockMs > 0;

  const cooldownMs = useMemo(() => Math.max(0, cooldownUntil - Date.now()), [cooldownUntil]);

  const refreshPublicConfig = useCallback(async () => {
    const res = await groupDiscussionApi.getPublicConfig();
    const enabled = Boolean(res.success && res.data?.enabled);
    setFrontendEnabled(enabled);
    setFrontendEnabledChecked(true);
    return enabled;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setFrontendEnabled(false);
      setFrontendEnabledChecked(false);
      return;
    }

    const base = (config.apiUrl || "http://localhost:8000/api/v1").replace(/\/$/, "");
    const url = `${base}/ai-agents/group-discussion/public-config/stream`;
    let stop: (() => void) | null = null;

    const start = () => {
      refreshPublicConfig().catch(() => null);
      const useEventSource = base.startsWith("/");
      if (useEventSource) {
        setFrontendEnabledChecked(true);
        let pollTimer: number | null = null;
        const startFallbackPoll = () => {
          if (pollTimer) return;
          pollTimer = window.setInterval(() => {
            refreshPublicConfig().catch(() => null);
          }, 2000);
        };
        const stopFallbackPoll = () => {
          if (!pollTimer) return;
          window.clearInterval(pollTimer);
          pollTimer = null;
        };

        const es = new EventSource(url);
        es.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data) as any;
            const enabled = Boolean(payload?.enabled);
            setFrontendEnabled(enabled);
            stopFallbackPoll();
          } catch {
            return;
          }
        };
        es.onerror = () => {
          startFallbackPoll();
        };
        stop = () => {
          stopFallbackPoll();
          es.close();
        };
      }

      let closed = false;
      const controller = new AbortController();
      let attempt = 0;
      setFrontendEnabledChecked(true);

      const loop = async () => {
        while (!closed) {
          try {
            const res = await fetch(url, {
              method: "GET",
              credentials: "include",
              signal: controller.signal,
            });
            if (!res.ok || !res.body) throw new Error(`sse http ${res.status}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            setFrontendEnabledChecked(true);
            attempt = 0;
            while (!closed) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split("\n\n");
              buffer = parts.pop() || "";
              for (const part of parts) {
                const lines = part.split("\n").map((l) => l.trimEnd());
                const dataLine = lines.find((l) => l.startsWith("data: "));
                if (!dataLine) continue;
                const jsonText = dataLine.slice("data: ".length);
                try {
                  const payload = JSON.parse(jsonText) as any;
                  const enabled = Boolean(payload?.enabled);
                  setFrontendEnabled(enabled);
                } catch {
                  continue;
                }
              }
            }
            if (!closed) throw new Error("sse closed");
          } catch {
            if (closed) return;
            attempt += 1;
            await refreshPublicConfig();
            const delay = Math.min(10000, 500 * Math.pow(2, Math.min(attempt, 4)));
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      };

      loop();
      stop = () => {
        closed = true;
        controller.abort();
      };
    };

    start();
    return () => {
      if (stop) stop();
    };
  }, [isAuthenticated, refreshPublicConfig]);

  useEffect(() => {
    if (!open) return;
    if (!frontendEnabledChecked) return;
    if (frontendEnabled) return;
    setOpen(false);
    message.info("小组讨论已关闭");
  }, [frontendEnabled, frontendEnabledChecked, open]);

  const fetchGroups = useCallback(
    async (keyword?: string) => {
      if (!open) return;
      if (!canUse) return;
      if (frontendEnabledChecked && !frontendEnabled) return;
      try {
        setGroupsLoading(true);
        const res = await groupDiscussionApi.listGroups({
          keyword: keyword?.trim() || undefined,
          limit: 200,
        });
        if (!res.success) return;
        setAvailableGroups(res.data.items || []);
      } finally {
        setGroupsLoading(false);
      }
    },
    [canUse, frontendEnabled, frontendEnabledChecked, open],
  );

  useEffect(() => {
    if (!open) return;
    if (!canUse) return;
    let canceled = false;
    const timer = window.setTimeout(async () => {
      try {
        await fetchGroups(groupKeyword);
      } finally {
      }
    }, 250);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [open, canUse, groupKeyword, fetchGroups]);

  const sortedGroups = useMemo(() => {
    const items = availableGroups.slice();
    items.sort((a, b) => {
      const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
      const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
      if (tb !== ta) return tb - ta;
      const ca = Number(a.message_count || 0);
      const cb = Number(b.message_count || 0);
      if (cb !== ca) return cb - ca;
      return String(a.group_no).localeCompare(String(b.group_no));
    });
    return items;
  }, [availableGroups]);

  const join = async () => {
    const value = groupNo.trim();
    if (!value) {
      message.warning("请输入组号");
      return;
    }
    if (!canUse) {
      message.warning("仅登录学生/管理员可使用小组讨论");
      return;
    }
    if (groupLocked) {
      message.warning(`组号已锁定，${Math.ceil(lockMs / 1000)}秒后可更改`);
      return;
    }
    setJoining(true);
    try {
      const res = await groupDiscussionApi.join({ groupNo: value, groupName: groupName.trim() || undefined });
      if (!res.success) {
        message.error(res.message || "加入失败");
        return;
      }
      localStorage.setItem(GROUP_NO_KEY, value);
      setGroupNo(value);
      localStorage.setItem(CLASS_NAME_KEY, res.data.class_name || "");
      setClassName(res.data.class_name || "");
      localStorage.setItem(GROUP_NAME_KEY, res.data.group_name || "");
      setGroupName(res.data.group_name || "");
      setMyDisplayName(res.data.display_name || "");
      setSessionId(res.data.session_id);
      setSessionDate(res.data.session_date);
      setMessagesList([]);
      setAfterId(0);
      const lockSeconds = Math.max(180, Number(res.data.group_lock_seconds || 0) || 0);
      const until = Date.now() + lockSeconds * 1000;
      localStorage.setItem(GROUP_LOCK_UNTIL_KEY, String(until));
      setGroupLockedUntil(until);
      localStorage.setItem(GROUP_NAME_LOCK_UNTIL_KEY, "0");
      setGroupNameLockedUntil(0);
      const nameLabel = res.data.group_name ? ` · ${res.data.group_name}` : "";
      message.success(`已加入 ${res.data.session_date} · ${res.data.class_name} · ${value}组${nameLabel}`);
    } finally {
      setJoining(false);
    }
  };

  const submitGroupName = async () => {
    if (!sessionId) return;
    if (groupNameLocked) {
      message.warning(`组名已锁定，${Math.ceil(groupNameLockMs / 1000)}秒后可修改`);
      return;
    }
    const v = groupName.trim();
    if (!v) {
      message.warning("请输入组名");
      return;
    }
    const res = await groupDiscussionApi.setGroupName({ sessionId, groupName: v });
    if (!res.success) {
      message.error(res.message || "设置失败");
      return;
    }
    localStorage.setItem(GROUP_NAME_KEY, res.data.group_name || "");
    setGroupName(res.data.group_name || "");
    const until = Date.now() + 180 * 1000;
    localStorage.setItem(GROUP_NAME_LOCK_UNTIL_KEY, String(until));
    setGroupNameLockedUntil(until);
    message.success("组名已更新");
  };

  const mergeMessages = useCallback(
    (
      prev: Array<{ id: number; user_display_name: string; content: string; created_at: string }>,
      next: Array<{ id: number; user_display_name: string; content: string; created_at: string }>,
    ) => {
      if (next.length === 0) return prev;
      const seen = new Set(prev.map((m) => m.id));
      const merged = prev.slice();
      for (const m of next) {
        if (seen.has(m.id)) continue;
        merged.push(m);
        seen.add(m.id);
      }
      return merged;
    },
    [],
  );

  const loadNewMessages = useCallback(async () => {
    if (!sessionId) return;
    const res = await groupDiscussionApi.listMessages({ sessionId, afterId: afterIdRef.current, limit: 100 });
    if (!res.success) return;
    const items = res.data.items || [];
    if (items.length === 0) return;
    setMessagesList((prev) =>
      mergeMessages(
        prev,
        items.map((m) => ({
          id: m.id,
          user_display_name: m.user_display_name,
          content: m.content,
          created_at: m.created_at,
        })),
      ),
    );
    setAfterId((v) => Math.max(v, Number(res.data.next_after_id || 0) || v));
  }, [mergeMessages, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (!open) return;
    let closed = false;
    const controller = new AbortController();

    const startSseOnce = async () => {
      const base = (config.apiUrl || "http://localhost:8000/api/v1").replace(/\/$/, "");
      const url = `${base}/ai-agents/group-discussion/stream?session_id=${sessionId}&after_id=${afterIdRef.current}`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`sse http ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      setPolling(true);
      try {
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const lines = part.split("\n").map((l) => l.trimEnd());
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const jsonText = dataLine.slice("data: ".length);
            try {
              const payload = JSON.parse(jsonText) as any;
              const items = (payload?.items || []) as any[];
              const nextAfter = Number(payload?.next_after_id || 0);
              if (items.length > 0) {
                setMessagesList((prev) =>
                  mergeMessages(
                    prev,
                    items.map((m) => ({
                      id: Number(m.id),
                      user_display_name: String(m.user_display_name || ""),
                      content: String(m.content || ""),
                      created_at: String(m.created_at || ""),
                    })),
                  ),
                );
              }
              if (Number.isFinite(nextAfter) && nextAfter > 0) {
                setAfterId((v) => Math.max(v, nextAfter));
              }
            } catch {
              continue;
            }
          }
        }
        if (!closed) throw new Error("sse closed");
      } finally {
        setPolling(false);
      }
    };

    const startPollingFallback = () => {
      let alive = true;
      setPolling(true);
      loadNewMessages().finally(() => {
        if (alive) setPolling(false);
      });
      const timer = window.setInterval(() => {
        loadNewMessages();
      }, 2000);
      return () => {
        alive = false;
        window.clearInterval(timer);
      };
    };

    let stopFallback: (() => void) | null = null;
    const run = async () => {
      let attempt = 0;
      while (!closed) {
        try {
          if (stopFallback) {
            stopFallback();
            stopFallback = null;
          }
          await startSseOnce();
          attempt = 0;
        } catch {
          if (closed) break;
          attempt += 1;
          if (!stopFallback) stopFallback = startPollingFallback();
          const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5)));
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    };

    run();

    return () => {
      closed = true;
      controller.abort();
      if (stopFallback) stopFallback();
    };
  }, [loadNewMessages, open, sessionId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messagesList.length]);

  const send = async () => {
    if (!sessionId) {
      message.warning("请先加入组号");
      return;
    }
    const content = draft.trim();
    if (!content) return;
    if (sendingRef.current) return;
    const now = Date.now();
    if (now < cooldownUntilRef.current) return;

    sendingRef.current = true;
    setSending(true);
    cooldownUntilRef.current = now + 5000;
    setCooldownUntil(cooldownUntilRef.current);
    setDraft("");
    try {
      const res = await groupDiscussionApi.sendMessage({ sessionId, content });
      if (!res.success) {
        cooldownUntilRef.current = 0;
        setCooldownUntil(0);
        setDraft(content);
        message.error(res.message || "发送失败");
        return;
      }
      setMessagesList((prev) =>
        mergeMessages(prev, [
          {
            id: res.data.id,
            user_display_name: res.data.user_display_name,
            content: res.data.content,
            created_at: res.data.created_at,
          },
        ]),
      );
      setAfterId((v) => Math.max(v, res.data.id));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const onFloatingHeaderPointerDown = (e: React.PointerEvent) => {
    if (floatingPinned) return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: floatingPos.x,
      originY: floatingPos.y,
    };
  };

  const onFloatingHeaderPointerMove = (e: React.PointerEvent) => {
    const s = draggingRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const next = { x: s.originX + dx, y: s.originY + dy };
    setFloatingPos(next);
  };

  const onFloatingHeaderPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    localStorage.setItem(FLOATING_POS_KEY, JSON.stringify(floatingPos));
  };

  const togglePinned = () => {
    const next = !floatingPinned;
    setFloatingPinned(next);
    localStorage.setItem(FLOATING_PINNED_KEY, next ? "1" : "0");
  };

  const persistFloatingSize = () => {
    const el = floatingRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const next = { w: Math.max(320, Math.min(680, w)), h: Math.max(260, Math.min(720, h)) };
    setFloatingSize(next);
    localStorage.setItem(FLOATING_SIZE_KEY, JSON.stringify(next));
  };

  const joinPanel = (
    <Card
      size="small"
      title={
        <Space size={8}>
          <TeamOutlined style={{ color: "var(--ws-color-primary)" }} />
          <Text strong>加入/切换小组</Text>
        </Space>
      }
      styles={{
        body: {
          padding: 10,
          background: "#ffffff",
          borderRadius: 10,
        },
      }}
      style={{ borderRadius: 10 }}
    >
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        <Text type="secondary">{isAdmin ? "管理员模式" : `班级：${className || "（加入后自动显示）"}`}</Text>
        <Select
          showSearch
          allowClear
          loading={groupsLoading}
          value={null}
          placeholder="选择已有小组（支持搜索组号/组名）"
          filterOption={false}
          onSearch={(v) => setGroupKeyword(v)}
          onDropdownVisibleChange={(visible) => {
            if (!visible) return;
            setGroupKeyword("");
            fetchGroups();
          }}
          onChange={(v) => {
            if (!v) return;
            const hit = availableGroups.find((g) => String(g.session_id) === String(v));
            if (!hit) return;
            setGroupNo(String(hit.group_no));
            setGroupName(hit.group_name || "");
          }}
          notFoundContent={
            groupsLoading ? <Spin size="small" /> : <Text type="secondary">暂无小组，可输入搜索或直接填组号加入</Text>
          }
          options={sortedGroups.map((g) => ({
            value: String(g.session_id),
            label: `${g.group_no}组${g.group_name ? ` · ${g.group_name}` : ""}${
              Number(g.message_count || 0) > 0 ? ` · ${g.message_count}条` : ""
            }`,
          }))}
          style={{ width: "100%" }}
        />
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={groupNo}
            onChange={(e) => setGroupNo(e.target.value)}
            placeholder="组号"
            disabled={groupLocked}
            onPressEnter={join}
            style={{ width: 96 }}
          />
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="组名（可选）"
            disabled={!sessionId && groupLocked}
            onPressEnter={join}
          />
          <Button type="primary" loading={joining} onClick={join} disabled={groupLocked}>
            {groupLocked ? `${Math.ceil(lockMs / 1000)}s` : "加入"}
          </Button>
          <Button
            onClick={submitGroupName}
            disabled={!sessionId || !groupName.trim() || groupNameLocked}
          >
            {groupNameLocked ? `${Math.ceil(groupNameLockMs / 1000)}s` : "设置名"}
          </Button>
        </Space.Compact>
        <Text type="secondary">
          {sessionId
            ? `当前：${sessionDate} · ${className} · ${groupNo}组${groupName.trim() ? ` · ${groupName.trim()}` : ""}`
            : "建议：先选已有组或输入组号加入；创建者可设置组名。"}
        </Text>
      </Space>
    </Card>
  );

  const messageBubbleList = (style?: React.CSSProperties) => (
    <div
      ref={listRef}
      style={{
        ...style,
        overflow: "auto",
        borderRadius: 10,
        padding: 10,
        background: "#ffffff",
        border: "1px solid var(--ws-color-border)",
      }}
    >
      {messagesList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "18px 0" }}>
          <Text type="secondary">{sessionId ? "暂无消息" : "请先加入组号"}</Text>
        </div>
      ) : (
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          {messagesList.map((it) => {
            const isMine = myDisplayName && it.user_display_name === myDisplayName;
            const nameLabel = isMine ? "我" : it.user_display_name;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  justifyContent: isMine ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ maxWidth: "88%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    <Text strong style={{ fontSize: 12 }}>
                      {nameLabel}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(it.created_at).toLocaleTimeString()}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid var(--ws-color-border)",
                      boxShadow: "none",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <Text style={{ color: "var(--ws-color-text)" }}>{it.content}</Text>
                  </div>
                </div>
              </div>
            );
          })}
        </Space>
      )}
    </div>
  );

  const composer = (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={sessionId ? "输入消息（5秒最多1条）" : "请先加入组号"}
        disabled={!sessionId || sending}
        onPressEnter={send}
      />
      <Button
        type="primary"
        onClick={send}
        disabled={!sessionId || sending || cooldownMs > 0 || !draft.trim()}
        loading={polling && messagesList.length === 0}
      >
        {cooldownMs > 0 ? `${Math.ceil(cooldownMs / 1000)}s` : "发送"}
      </Button>
    </Space.Compact>
  );

  return (
    <>
      {(!open &&
        canUse &&
        frontendEnabledChecked &&
        frontendEnabled) ? (
        <div style={{ position: "fixed", left: 0, top: "45%", zIndex: 1000 }}>
          <Badge count={unreadCount} size="small">
            <Button
              type="primary"
              icon={<TeamOutlined style={{ color: "inherit" }} />}
              onClick={async () => {
                const enabled = await refreshPublicConfig();
                if (!enabled) {
                  message.info("小组讨论已关闭");
                  return;
                }
                setOpen(true);
              }}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              小组讨论
            </Button>
          </Badge>
        </div>
      ) : null}

      {open ? (
        <div
          ref={floatingRef}
          style={{
            position: "fixed",
            left: floatingPos.x,
            top: floatingPos.y,
            width: floatingSize.w,
            height: floatingSize.h,
            zIndex: 1200,
            resize: "both",
            overflow: "hidden",
            minWidth: 320,
            minHeight: 260,
            maxWidth: 680,
            maxHeight: 720,
          }}
          onMouseUp={persistFloatingSize}
        >
          <Card
            styles={{
              body: {
                padding: 10,
                height: `calc(100% - 56px)`,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              },
              header: {
                userSelect: "none",
                background: "#ffffff",
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
              },
            }}
            style={{
              height: "100%",
              borderRadius: 10,
              boxShadow: "none",
              border: "1px solid var(--ws-color-border)",
            }}
            title={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div
                  onPointerDown={onFloatingHeaderPointerDown}
                  onPointerMove={onFloatingHeaderPointerMove}
                  onPointerUp={onFloatingHeaderPointerUp}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    cursor: floatingPinned ? "default" : "move",
                    paddingRight: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamOutlined style={{ color: "var(--ws-color-primary)" }} />
                    <span>小组讨论</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button
                      size="small"
                      type="text"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinned();
                      }}
                      icon={floatingPinned ? <PushpinFilled /> : <PushpinOutlined />}
                    />
                    <Button
                      size="small"
                      type="text"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                      }}
                    >
                      关闭
                    </Button>
                  </div>
                </div>
              </div>
            }
          >
            {!canUse ? (
              <Text type="secondary">仅登录学生/管理员可发送与查看小组讨论。</Text>
            ) : (
              <>
                {joinPanel}
                <Divider style={{ margin: "2px 0" }} />
                {messageBubbleList({ flex: 1, minHeight: 120 })}
                {composer}
              </>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
};

export default GroupDiscussionPanel;
