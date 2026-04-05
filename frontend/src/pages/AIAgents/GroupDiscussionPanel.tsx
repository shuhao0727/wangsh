import { showMessage } from "@/lib/toast";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Loader2,
  LogOut,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { groupDiscussionApi } from "@services/agents";
import { config as appConfig } from "@services";
import { userApi } from "@services";
import { getStoredAccessToken } from "@services/api";
import type { GroupDiscussionGroup, GroupDiscussionMember, GroupDiscussionPublicConfig } from "@services/znt/api/group-discussion-api";
import type { User } from "@services/users";
import { logger } from "@services/logger";
import { getJoinLockRemainingSeconds, parseJoinLockHint, type JoinLockHint } from "./groupDiscussionJoinLock";
import EmptyState from "@components/Common/EmptyState";
import dayjs from "dayjs";
import { floatingBtnRegistry } from "@utils/floatingBtnRegistry";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PushpinFilled = Pin;
const PushpinOutlined = PinOff;
const TeamOutlined = Users;
const UserOutlined = UserIcon;
const SearchOutlined = Search;
const PlusOutlined = Plus;
const LogoutOutlined = LogOut;
const ReloadOutlined = RefreshCw;
const UserAddOutlined = UserPlus;
const DeleteOutlined = Trash2;
const CloseOutlined = X;

const STORAGE_KEYS = {
  SESSION_ID: "gd_session_id",
  GROUP_NO: "gd_group_no",
  GROUP_NAME: "gd_group_name",
  FLOATING_POS: "gd_floating_pos",
  FLOATING_SIZE: "gd_floating_size",
  FLOATING_PINNED: "gd_floating_pinned",
  BTN_TOP: "gd_btn_top",
};

type Props = {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  userId?: number;
  className?: string;
};

const GroupDiscussionPanel: React.FC<Props> = ({ isAuthenticated, isStudent, isAdmin, userId, className }) => {
  // --- 窗口状态管理 ---
  const [open, setOpen] = useState(false);
  const [floatingPinned, setFloatingPinned] = useState(() => localStorage.getItem(STORAGE_KEYS.FLOATING_PINNED) === "1");
  const [floatingPos, setFloatingPos] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEYS.FLOATING_POS) || "{}");
      return { x: Number(v.x) || 16, y: Number(v.y) || 120 };
    } catch { return { x: 16, y: 120 }; }
  });
  const [floatingSize, setFloatingSize] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEYS.FLOATING_SIZE) || "{}");
      return { w: Math.max(320, Number(v.w) || 420), h: Math.max(400, Number(v.h) || 500) };
    } catch { return { w: 420, h: 500 }; }
  });
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1280);
  
  const draggingRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [btnTop, setBtnTop] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEYS.BTN_TOP); return v ? Number(v) : 45; } catch { return 45; }
  });
  const btnDragRef = useRef<{ startY: number; origTop: number } | null>(null);
  const btnDragged = useRef(false);

  const [config, setConfig] = useState<GroupDiscussionPublicConfig>({ enabled: true, join_lock_seconds: 180, rate_limit_seconds: 5 });
  const [filterDate, setFilterDate] = useState<string | null>(() => dayjs().format("YYYY-MM-DD"));
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [classList, setClassList] = useState<string[]>([]);

  // --- 业务状态管理 ---
  const [view, setView] = useState<"intro" | "chat">("intro");
  const [introMode, setIntroMode] = useState<"join" | "create">("join");
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const v = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    return v ? Number(v) : null;
  });
  const [createGroupNo, setCreateGroupNo] = useState("");
  const [createGroupName, setCreateGroupName] = useState("");
  const [createClassName, setCreateClassName] = useState("");
  const [currentGroup, setCurrentGroup] = useState<{ no: string; name: string }>(() => ({
    no: localStorage.getItem(STORAGE_KEYS.GROUP_NO) || "",
    name: localStorage.getItem(STORAGE_KEYS.GROUP_NAME) || "",
  }));

  const [groups, setGroups] = useState<GroupDiscussionGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [joinLockHint, setJoinLockHint] = useState<JoinLockHint | null>(null);
  const [joinLockRemaining, setJoinLockRemaining] = useState(0);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [_polling, _setPolling] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const afterIdRef = useRef(0);
  const sendingRef = useRef(false);
  const chatRefreshingRef = useRef(false);

  // --- 成员管理状态 ---
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [members, setMembers] = useState<GroupDiscussionMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // --- 邀请用户状态 ---
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteKeyword, setInviteKeyword] = useState("");
  const [inviteUsers, setInviteUsers] = useState<User[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);

  const canUse = isAuthenticated && config.enabled && (isStudent || isAdmin);
  const isCompactViewport = viewportWidth <= 430;
  const floatingRenderWidth = isCompactViewport ? Math.max(320, viewportWidth - 8) : floatingSize.w;
  const floatingRenderHeight = isCompactViewport ? Math.max(360, Math.min(floatingSize.h, window.innerHeight - 90)) : floatingSize.h;
  const floatingRenderLeft = isCompactViewport ? 4 : floatingPos.x;
  const floatingRenderTop = isCompactViewport ? 72 : floatingPos.y;

  const clearDiscussionSessionState = useCallback((options?: { clearStorage?: boolean }) => {
    const clearStorage = options?.clearStorage ?? true;
    setSessionId(null);
    setCurrentGroup({ no: "", name: "" });
    setJoinLockHint(null);
    setJoinLockRemaining(0);
    setView("intro");
    setMessages([]);
    setDraft("");
    setSending(false);
    setChatRefreshing(false);
    afterIdRef.current = 0;
    if (!clearStorage) return;
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.GROUP_NO);
      localStorage.removeItem(STORAGE_KEYS.GROUP_NAME);
    } catch {}
  }, []);

  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth || 1280);
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  // --- 业务逻辑：成员管理 ---
  const fetchMembers = useCallback(async () => {
    if (!sessionId) return;
    setMembersLoading(true);
    try {
      const res = await groupDiscussionApi.adminListMembers({ sessionId });
      if (res.success) {
        setMembers(res.data.items || []);
      } else {
        showMessage.error(res.message);
      }
    } finally {
      setMembersLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (membersDrawerOpen) {
      fetchMembers();
    }
  }, [membersDrawerOpen, fetchMembers]);

  const handleKick = async (userId: number) => {
    if (!sessionId) return;
    try {
      const res = await groupDiscussionApi.adminRemoveMember({ sessionId, userId });
      if (res.success) {
        showMessage.success("移除成功");
        fetchMembers();
      } else {
        showMessage.error(res.message);
      }
    } catch (err) {
      logger.error(err);
      showMessage.error("移除成员失败，请重试");
    }
  };

  const handleSearchUsers = async () => {
    if (!inviteKeyword.trim()) return;
    setInviteLoading(true);
    try {
      const res = await userApi.getUsers({ search: inviteKeyword, limit: 20 });
      setInviteUsers(res.users || []);
    } catch (err) {
      logger.error(err);
      showMessage.error("搜索用户失败");
    } finally {
      setInviteLoading(false);
    }
  };

  // 防抖搜索用户
  useEffect(() => {
    if (!inviteModalOpen) return;
    const timer = setTimeout(handleSearchUsers, 300);
    return () => clearTimeout(timer);
  }, [inviteKeyword, inviteModalOpen]);

  const handleInvite = async (userId: number) => {
    if (!sessionId) return;
    setInvitingUserId(userId);
    try {
      const res = await groupDiscussionApi.adminAddMember({ sessionId, userId });
      if (res.success) {
        showMessage.success("邀请成功");
        setInviteModalOpen(false);
        fetchMembers();
      } else {
        showMessage.error(res.message);
      }
    } catch (err) {
      logger.error(err);
      showMessage.error("邀请失败，请重试");
    } finally {
      setInvitingUserId(null);
    }
  };

  // --- 窗口拖拽逻辑 ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (floatingPinned || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = { startX: e.clientX, startY: e.clientY, originX: floatingPos.x, originY: floatingPos.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setFloatingPos({ x: draggingRef.current.originX + dx, y: draggingRef.current.originY + dy });
  };
  const handlePointerUp = () => {
    draggingRef.current = null;
    localStorage.setItem(STORAGE_KEYS.FLOATING_POS, JSON.stringify(floatingPos));
  };

  // --- 浮动按钮拖拽（仅垂直）---
  const handleBtnDragStart = useCallback((e: React.PointerEvent) => {
    btnDragRef.current = { startY: e.clientY, origTop: btnTop };
    btnDragged.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [btnTop]);
  const handleBtnDragMove = useCallback((e: React.PointerEvent) => {
    if (!btnDragRef.current) return;
    if (Math.abs(e.clientY - btnDragRef.current.startY) > 3) btnDragged.current = true;
    const newTop = Math.max(0, Math.min(90, btnDragRef.current.origTop + (e.clientY - btnDragRef.current.startY) / window.innerHeight * 100));
    setBtnTop(newTop);
  }, []);
  const handleBtnDragEnd = useCallback(() => {
    if (!btnDragRef.current) return;
    btnDragRef.current = null;
    try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(btnTop)); } catch {}
    floatingBtnRegistry.settle("discussion");
  }, [btnTop]);

  // 注册到全局按钮注册表
  useEffect(() => {
    floatingBtnRegistry.register("discussion", btnTop, (v) => {
      setBtnTop(v);
      try { localStorage.setItem(STORAGE_KEYS.BTN_TOP, String(v)); } catch {}
    });
    return () => floatingBtnRegistry.unregister("discussion");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    floatingBtnRegistry.updateTop("discussion", btnTop);
  }, [btnTop]);
  const handleResizeUp = () => {
    if (floatingRef.current) {
      const rect = floatingRef.current.getBoundingClientRect();
      const size = { w: rect.width, h: rect.height };
      setFloatingSize(size);
      localStorage.setItem(STORAGE_KEYS.FLOATING_SIZE, JSON.stringify(size));
    }
  };

  // --- 初始化与会话恢复 ---
  useEffect(() => {
    groupDiscussionApi.getPublicConfig().then(res => {
      if (res.success) {
        setConfig(res.data);
      }
    });
  }, []);

  // 监听 filterDate 变化，动态更新班级列表
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      // 无论 filterDate 是否为空，都去获取班级列表
      // 如果 filterDate 为空，后端应当返回所有日期的班级列表（或默认策略）
      // 如果 filterDate 不为空，后端返回该日期的班级列表
      groupDiscussionApi.adminListClasses({ date: filterDate || undefined }).then(res => {
        if (res.success) {
          setClassList(res.data);
          return;
        }
      });
      return;
    }
    setClassList([]);
    setFilterClass(null);
  }, [isAuthenticated, isAdmin, filterDate]);

  useEffect(() => {
    if (filterClass && !classList.includes(filterClass)) {
      setFilterClass(null);
    }
  }, [filterClass, classList]);

  useEffect(() => {
    if (!isAdmin || introMode !== "create") return;
    const existing = String(createClassName || "").trim();
    if (existing) return;
    const fallbackClass = String(filterClass || classList[0] || "").trim();
    if (fallbackClass) {
      setCreateClassName(fallbackClass);
    }
  }, [isAdmin, introMode, filterClass, classList, createClassName]);

  useEffect(() => {
    if (!joinLockHint) {
      setJoinLockRemaining(0);
      return;
    }
    const syncRemaining = () => {
      const remaining = getJoinLockRemainingSeconds(joinLockHint);
      setJoinLockRemaining(remaining);
      if (remaining <= 0) {
        setJoinLockHint(null);
      }
    };
    syncRemaining();
    const timer = window.setInterval(syncRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [joinLockHint]);

  // --- 业务逻辑：获取小组列表 ---
  const fetchGroups = useCallback(async () => {
    if (!open || view !== "intro") return;
    setGroupsLoading(true);
    try {
      const res = await groupDiscussionApi.listGroups({
        keyword: searchKeyword,
        limit: 100,
        date: filterDate || undefined,
        className: filterClass || undefined,
      });
      if (res.success) {
        setGroups(res.data.items || []);
      }
    } finally {
      setGroupsLoading(false);
    }
  }, [open, view, searchKeyword, filterDate, filterClass]);

  // 自动刷新：当切换到“加入小组”模式或筛选变更时
  useEffect(() => {
    if (introMode === 'join') {
      fetchGroups();
    }
  }, [introMode, fetchGroups]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(fetchGroups, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // --- 业务逻辑：加入/创建小组 ---
  const handleJoinOrCreate = async (values: { groupNo: string; groupName?: string; className?: string }) => {
    try {
      if (isAdmin && !String(values.className || "").trim()) {
        showMessage.error("请先填写班级");
        return;
      }
      const res = await groupDiscussionApi.join({
        groupNo: values.groupNo,
        groupName: values.groupName,
        className: values.className,
      });
      
      if (!res.success) {
        setJoinLockHint(parseJoinLockHint(res.message));
        showMessage.error(res.message || "操作失败");
        return;
      }

      const { session_id, group_no, group_name } = res.data;
      setJoinLockHint(null);
      
      // 更新状态
      setSessionId(session_id);
      setCurrentGroup({ no: group_no, name: group_name || "" });
      
      // 持久化
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, String(session_id));
      localStorage.setItem(STORAGE_KEYS.GROUP_NO, group_no);
      localStorage.setItem(STORAGE_KEYS.GROUP_NAME, group_name || "");
      
      showMessage.success(`成功加入 ${group_no} 组`);
      setMessages([]);
      afterIdRef.current = 0;
      setView("chat");

      // 主动加载历史消息（防止 sessionId 未变时 useEffect 不重新触发）
      try {
        const msgRes = await groupDiscussionApi.listMessages({ sessionId: session_id, afterId: 0, limit: 50 });
        if (msgRes.success && msgRes.data.items.length > 0) {
          setMessages(msgRes.data.items.map((m: any) => ({ ...m, is_mine: userId ? m.user_id === userId : false })));
          afterIdRef.current = msgRes.data.next_after_id;
        }
      } catch {}
    } catch (err) {
      logger.error(err);
    }
  };

  const handleCreateSubmit = async () => {
    const groupNo = createGroupNo.trim();
    const groupName = createGroupName.trim();
    const targetClass = createClassName.trim();
    if (isAdmin && !targetClass) {
      showMessage.error("请先填写班级");
      return;
    }
    if (!groupNo) {
      showMessage.error("请输入组号");
      return;
    }
    if (!/^\d+$/.test(groupNo)) {
      showMessage.error("组号只能包含数字");
      return;
    }
    if (!groupName) {
      showMessage.error("请输入组名");
      return;
    }
    await handleJoinOrCreate({
      groupNo,
      groupName,
      className: targetClass || undefined,
    });
  };

  // --- 业务逻辑：发送消息 ---
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !sessionId || sendingRef.current) return;
    
    // 前端冷却校验
    const now = Date.now();
    const rateMs = (config.rate_limit_seconds || 5) * 1000;
    if (!isAdmin && now - lastSendTime < rateMs) {
      showMessage.warning(`请等待 ${Math.ceil((rateMs - (now - lastSendTime)) / 1000)} 秒后再发送`);
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      const res = await groupDiscussionApi.sendMessage({ sessionId, content: text });
      if (res.success) {
        setDraft("");
        setLastSendTime(Date.now());
        // 乐观更新消息列表
        setMessages(prev => [...prev, {
          id: res.data.id,
          user_display_name: res.data.user_display_name,
          content: res.data.content,
          created_at: res.data.created_at,
          is_mine: true
        }]);
        afterIdRef.current = Math.max(afterIdRef.current, res.data.id);
        scrollToBottom();
      } else {
        showMessage.error(res.message);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // --- 业务逻辑：退出小组 ---
  const handleExit = useCallback(() => {
    clearDiscussionSessionState({ clearStorage: true });
    void fetchGroups(); // 刷新列表
  }, [clearDiscussionSessionState, fetchGroups]);

  // --- 消息加载与轮询 ---
  const loadMessages = useCallback(async (sid: number) => {
    const res = await groupDiscussionApi.listMessages({
      sessionId: sid,
      afterId: afterIdRef.current,
      limit: 50
    });
    if (res.success && res.data.items.length > 0) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const newItems = res.data.items.filter(m => !ids.has(m.id)).map(m => ({ ...m, is_mine: userId ? m.user_id === userId : false }));
        return [...prev, ...newItems].sort((a, b) => a.id - b.id);
      });
      afterIdRef.current = res.data.next_after_id;
      scrollToBottom();
    }
  }, [userId]);

  useEffect(() => {
    if (isAuthenticated) return;
    setOpen(false);
    setMembersDrawerOpen(false);
    setInviteModalOpen(false);
    clearDiscussionSessionState({ clearStorage: true });
  }, [isAuthenticated, clearDiscussionSessionState]);

  const handleManualRefresh = useCallback(async () => {
    if (view === "intro") {
      await fetchGroups();
      return;
    }
    if (!sessionId) {
      showMessage.warning("当前未加入小组");
      return;
    }
    if (chatRefreshingRef.current) return;
    chatRefreshingRef.current = true;
    setChatRefreshing(true);
    try {
      const res = await groupDiscussionApi.listMessages({
        sessionId,
        afterId: 0,
        limit: 200,
      });
      if (!res.success) {
        showMessage.error(res.message || "刷新失败");
        return;
      }
      const fullItems = (res.data.items || [])
        .map((m: any) => ({ ...m, is_mine: userId ? m.user_id === userId : false }))
        .sort((a: any, b: any) => a.id - b.id);
      setMessages(fullItems);
      afterIdRef.current = res.data.next_after_id || (fullItems.length > 0 ? fullItems[fullItems.length - 1].id : 0);
      scrollToBottom();
    } catch (err) {
      logger.error(err);
      showMessage.error("刷新失败，请稍后重试");
    } finally {
      chatRefreshingRef.current = false;
      setChatRefreshing(false);
    }
  }, [view, fetchGroups, sessionId, userId]);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    if (sessionId) {
      setView("chat");
      // 尝试加载一次消息来验证 Session 有效性
      loadMessages(sessionId).catch(() => {
        handleExit(); // 如果加载失败（如404），退出到列表
      });
      return;
    }
    setView("intro");
    fetchGroups();
  }, [open, isAuthenticated, sessionId, loadMessages, handleExit, fetchGroups]);

  useEffect(() => {
    if (!isAuthenticated || view !== "chat" || !sessionId) return;

    // 使用 SSE 实时接收消息，替代轮询
    const token = getStoredAccessToken() || "";
    const sseUrl = `${appConfig.apiUrl}/ai-agents/group-discussion/stream?session_id=${sessionId}&after_id=${afterIdRef.current}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    let eventSource: EventSource | null = null;
    let fallbackActive = false;

    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.items && data.items.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const newItems = data.items.filter((m: any) => !ids.has(m.id)).map((m: any) => ({
                ...m,
                is_mine: userId ? m.user_id === userId : false,
              }));
              return [...prev, ...newItems].sort((a: any, b: any) => a.id - b.id);
            });
            if (data.next_after_id) {
              afterIdRef.current = data.next_after_id;
            }
            scrollToBottom();
          }
        } catch {}
      };

      eventSource.onerror = () => {
        // SSE 断开后回退到轮询
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!fallbackActive) {
          fallbackActive = true;
          const poll = async () => {
            if (!fallbackActive) return;
            await loadMessages(sessionId);
            if (fallbackActive) setTimeout(poll, 3000);
          };
          poll();
        }
      };
    } catch {
      // EventSource 不可用，直接轮询
      fallbackActive = true;
      const poll = async () => {
        if (!fallbackActive) return;
        await loadMessages(sessionId);
        if (fallbackActive) setTimeout(poll, 3000);
      };
      poll();
    }

    return () => {
      fallbackActive = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [isAuthenticated, view, sessionId, userId, loadMessages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  // --- 渲染组件 ---

  const renderIntro = () => (
    <div className="flex h-full flex-col px-1">
      <div className="mb-3 grid grid-cols-2 gap-[var(--ws-space-1)] rounded-md border border-[var(--ws-color-border)] bg-surface p-1">
        {[
          { key: "join", label: "加入小组", icon: <TeamOutlined className="h-4 w-4" /> },
          { key: "create", label: "新建小组", icon: <PlusOutlined className="h-4 w-4" /> },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
              introMode === item.key
                ? "bg-surface text-text shadow-sm"
                : "text-text-tertiary hover:text-text",
            )}
            onClick={() => setIntroMode(item.key as "join" | "create")}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {joinLockHint && joinLockRemaining > 0 ? (
        <Alert className="mb-3 border-warning/25 bg-warning-soft text-warning [&>svg]:text-warning">
          <AlertTitle>{`组号已锁定为 ${joinLockHint.lockedGroupNo} 组`}</AlertTitle>
          <AlertDescription>
            {`请在 ${joinLockRemaining} 秒后切换到其他组，或直接加入 ${joinLockHint.lockedGroupNo} 组。`}
          </AlertDescription>
        </Alert>
      ) : null}

      {introMode === "join" ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {isAdmin ? (
            <div className="mb-3 flex w-full flex-wrap gap-2">
              <Input
                type="date"
                value={filterDate || ""}
                placeholder="日期"
                className={isCompactViewport ? "w-full" : "w-36"}
                onChange={(e) => setFilterDate(e.target.value || null)}
              />
              <Select
                value={filterClass || "__all__"}
                onValueChange={(v) => setFilterClass(v === "__all__" ? null : v)}
              >
                <SelectTrigger className={isCompactViewport ? "w-full" : "w-32"}>
                  <SelectValue placeholder="班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部班级</SelectItem>
                  {classList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className={cn("relative", isCompactViewport ? "w-full" : "min-w-44 flex-1")}>
                <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  value={searchKeyword}
                  placeholder="搜索组号/组名"
                  className="pl-[var(--ws-search-input-padding-start)]"
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="relative mb-3">
              <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={searchKeyword}
                placeholder="搜索组号或组名..."
                className="pl-[var(--ws-search-input-padding-start)]"
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {groupsLoading ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
              </div>
            ) : groups.length ? (
              <div className="flex flex-col gap-2 px-0.5">
                {groups.map((item) => (
                  <div
                    key={`${item.session_date}-${item.class_name || ""}-${item.group_no}`}
                    className="rounded-lg border border-[var(--ws-color-border)] bg-surface p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{item.group_no}组</span>
                          {item.group_name ? (
                            <Badge variant="outline">{item.group_name}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                          <span className="inline-flex items-center gap-1">
                            <UserOutlined className="h-4 w-4" />
                            {item.member_count}人
                          </span>
                          <span className="text-text-tertiary/40">|</span>
                          <span>{item.message_count}条消息</span>
                          <span className="text-text-tertiary/40">|</span>
                          <span>{dayjs(item.session_date).format("MM-DD")}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void handleJoinOrCreate({
                              groupNo: item.group_no,
                              className: item.class_name,
                            })
                          }
                        >
                          加入
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState description="暂无小组，快去新建一个吧" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-[var(--ws-space-3)] p-[var(--ws-panel-padding)]">
          {isAdmin ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">班级 (必填)</label>
              <Input
                value={createClassName}
                placeholder="例如: 高一(1)班"
                onChange={(e) => setCreateClassName(e.target.value)}
              />
              <p className="text-xs text-text-tertiary">
                {classList.length > 0
                  ? `建议使用已有班级：${classList.slice(0, 3).join("、")}`
                  : "请输入目标班级，例如：高一(1)班"}
              </p>
            </div>
          ) : className ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">班级</label>
              <Input value={className} disabled />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">组号 (必填)</label>
            <Input
              value={createGroupNo}
              placeholder="例如: 101"
              onChange={(e) => setCreateGroupNo(e.target.value)}
            />
            <p className="text-xs text-text-tertiary">请输入数字组号，如 101</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">组名 (必填)</label>
            <Input
              value={createGroupName}
              placeholder="例如: 飞跃小队"
              onChange={(e) => setCreateGroupName(e.target.value)}
            />
            <p className="text-xs text-text-tertiary">给小组起个好听的名字</p>
          </div>

          <Button type="button" className="w-full" onClick={() => void handleCreateSubmit()}>
            <PlusOutlined className="h-4 w-4" />
            立即创建并加入
          </Button>

          <div className="rounded-lg bg-surface-2 p-3 text-xs text-text-tertiary">
            <div className="mb-1">注意事项：</div>
            <div>
              1. 创建/加入小组后，需等待 {Math.ceil(config.join_lock_seconds / 60)} 分钟才能切换其他小组。
            </div>
            <div>2. 发送消息有 {config.rate_limit_seconds} 秒冷却限制。</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderChat = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--ws-color-border-secondary)] bg-surface px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{currentGroup.no}组</span>
            {currentGroup.name ? (
              <Badge variant="info">{currentGroup.name}</Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-text-tertiary">
            <TeamOutlined className="mr-1 inline h-4 w-4" />
            正在讨论中
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMembersDrawerOpen(true)}
          >
            <TeamOutlined className="h-4 w-4" />
            成员
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExit}>
            <LogoutOutlined className="h-4 w-4" />
            切换小组
          </Button>
        </div>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-[var(--ws-space-2)] overflow-y-auto bg-surface-2 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-3/4 ${msg.is_mine ? "self-end" : "self-start"}`}
          >
            <div
              className={`mb-0.5 px-[var(--ws-space-1)] text-xs text-text-tertiary ${msg.is_mine ? "text-right" : "text-left"}`}
            >
              {msg.is_mine ? "" : `${msg.user_display_name} · `}
              {dayjs(msg.created_at).format("HH:mm")}
            </div>
            <div
              className={`break-words whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
                msg.is_mine
                  ? "rounded-xl rounded-bl-[4px] bg-primary text-primary-foreground"
                  : "rounded-xl rounded-br-[4px] bg-surface text-text-base"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--ws-color-border-secondary)] bg-surface p-3">
        <div className="flex w-full items-center gap-2">
          <Input
            value={draft}
            placeholder="输入消息..."
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            发送
          </Button>
        </div>
        <div className="mt-1 text-center text-xs text-text-tertiary">
          每 {config.rate_limit_seconds} 秒可发送一条消息
        </div>
      </div>
    </div>
  );

  // --- 主渲染 ---
  if (!canUse) return null;

  return ReactDOM.createPortal(
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: `${btnTop}%`,
            zIndex: "var(--ws-z-floating-btn)",
            cursor: "grab",
            touchAction: "none",
          }}
          onPointerDown={handleBtnDragStart}
          onPointerMove={handleBtnDragMove}
          onPointerUp={handleBtnDragEnd}
        >
          <Button
            type="button"
            onClick={() => { if (!btnDragged.current) setOpen(true); }}
            className="ws-floating-entry-btn ws-floating-entry-btn--discussion"
          >
            <TeamOutlined className="h-4 w-4" />
            小组讨论
          </Button>
        </div>
      )}

      {/* 悬浮窗口 */}
      {open && (
        <div
          ref={floatingRef}
          className="ws-floating-panel flex flex-col"
          style={{
            position: "fixed",
            left: floatingRenderLeft,
            top: floatingRenderTop,
            width: floatingRenderWidth,
            height: floatingRenderHeight,
            zIndex: "var(--ws-z-floating-panel)",
            resize: isCompactViewport ? "none" : "both",
          }}
          onMouseUp={handleResizeUp}
        >
          {/* 窗口标题栏 */}
          <div
            className={`ws-floating-panel-header ws-floating-panel-header--discussion ${floatingPinned ? "cursor-default" : "cursor-move"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <span className="font-semibold text-sm flex items-center gap-1.5">
              <TeamOutlined className="h-4 w-4" /> 小组讨论
            </span>
            <div className="flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={floatingPinned ? "取消固定" : "固定窗口"}
                    className="h-8 w-8 ws-floating-panel-header-action"
                    onClick={() => {
                      const next = !floatingPinned;
                      setFloatingPinned(next);
                      localStorage.setItem(STORAGE_KEYS.FLOATING_PINNED, next ? "1" : "0");
                    }}
                  >
                    {floatingPinned ? <PushpinFilled className="h-4 w-4" /> : <PushpinOutlined className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{floatingPinned ? "取消固定" : "固定窗口"}</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="刷新"
                className="h-8 w-8 ws-floating-panel-header-action"
                disabled={view !== "intro" && (!sessionId || chatRefreshing)}
                onClick={() => { void handleManualRefresh(); }}
              >
                {(view === "intro" ? groupsLoading : chatRefreshing)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ReloadOutlined className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭窗口"
                className="h-8 w-8 ws-floating-panel-header-action"
                onClick={() => setOpen(false)}
              >
                <CloseOutlined className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 窗口内容区 */}
          <div className="flex-1 overflow-hidden bg-surface">
            {view === 'intro' ? renderIntro() : renderChat()}
          </div>
        </div>
      )}

      {/* 成员列表抽屉 */}
      <Sheet open={membersDrawerOpen} onOpenChange={setMembersDrawerOpen}>
        <SheetContent side="right" className="w-[26rem] p-0 sm:max-w-[26rem]">
          <SheetHeader className="border-b border-[var(--ws-color-border)] px-4 py-3">
            <div className="flex items-center justify-between gap-3 pr-8">
              <SheetTitle>{`成员列表 (${members.length})`}</SheetTitle>
              {isAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                >
                  <UserAddOutlined className="h-4 w-4" />
                  邀请
                </Button>
              ) : null}
            </div>
          </SheetHeader>
          <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
        {membersLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : members.length ? (
          <div className="flex flex-col gap-2">
            {members.map((item) => (
              <div
                key={String(item.user_id)}
                className="rounded-lg border border-[var(--ws-color-border)] bg-surface p-3"
              >
                <div className="flex justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <Avatar className="h-9 w-9 bg-primary text-white">
                      <AvatarFallback>
                        <UserOutlined className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.full_name || item.username || `User ${item.user_id}`}
                      </div>
                      {item.student_id ? (
                        <div className="text-xs text-text-tertiary">{item.student_id}</div>
                      ) : null}
                      <div className="text-xs text-text-tertiary">
                        {dayjs(item.joined_at).format("MM-DD HH:mm")}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (!window.confirm("确认移除该成员吗？")) return;
                        void handleKick(item.user_id);
                      }}
                    >
                      <DeleteOutlined className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState description="暂无成员" />
        )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 邀请用户弹窗 */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>邀请用户</DialogTitle>
          </DialogHeader>
        <div className="relative mb-4">
          <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="搜索姓名、学号..."
            value={inviteKeyword}
            onChange={e => setInviteKeyword(e.target.value)}
            className="pl-[var(--ws-search-input-padding-start)]"
            autoFocus
          />
        </div>
        <div className="max-h-[25rem] overflow-y-auto">
          {inviteLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
            </div>
          ) : inviteUsers.length ? (
            <div className="flex flex-col gap-2">
              {inviteUsers.map((user) => {
                const isMember = members.some((m) => m.user_id === user.id);
                return (
                  <div key={String(user.id)} className="rounded-lg border border-[var(--ws-color-border)] bg-surface p-3">
                    <div className="flex justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <Avatar>
                          <AvatarImage />
                          <AvatarFallback>{(user.full_name || user.username || "?")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                            {user.full_name}
                          </div>
                          <div className="text-xs text-text-tertiary">
                            {`${user.student_id || ""} ${user.class_name || ""}`.trim()}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isMember}
                        onClick={() => void handleInvite(user.id)}
                      >
                        {invitingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isMember ? "已加入" : "邀请"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState variant={inviteKeyword ? "no-results" : "no-data"} description={inviteKeyword ? "未找到用户" : "请输入关键词搜索"} />
          )}
        </div>
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
};

export default GroupDiscussionPanel;
