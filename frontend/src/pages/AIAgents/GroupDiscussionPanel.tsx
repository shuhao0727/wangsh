import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Input,
  List,
  Segmented,
  Space,
  Spin,
  Typography,
  message,
  Tag,
  Tooltip,
  Form,
  Empty
} from "antd";
import {
  PushpinFilled,
  PushpinOutlined,
  TeamOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  LogoutOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { groupDiscussionApi } from "@services/agents";
import { config } from "@services";
import type { GroupDiscussionGroup } from "@services/znt/api/group-discussion-api";
import dayjs from "dayjs";

const { Text, Title } = Typography;

const STORAGE_KEYS = {
  SESSION_ID: "gd_session_id",
  GROUP_NO: "gd_group_no",
  GROUP_NAME: "gd_group_name",
  FLOATING_POS: "gd_floating_pos",
  FLOATING_SIZE: "gd_floating_size",
  FLOATING_PINNED: "gd_floating_pinned",
};

type Props = {
  isAuthenticated: boolean;
  isStudent: boolean;
  isAdmin: boolean;
};

const GroupDiscussionPanel: React.FC<Props> = ({ isAuthenticated, isStudent, isAdmin }) => {
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
  
  const draggingRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  // --- 业务状态管理 ---
  const [view, setView] = useState<"intro" | "chat">("intro");
  const [introMode, setIntroMode] = useState<"join" | "create">("join");
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const v = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    return v ? Number(v) : null;
  });
  const [currentGroup, setCurrentGroup] = useState<{ no: string; name: string }>(() => ({
    no: localStorage.getItem(STORAGE_KEYS.GROUP_NO) || "",
    name: localStorage.getItem(STORAGE_KEYS.GROUP_NAME) || "",
  }));

  const [groups, setGroups] = useState<GroupDiscussionGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  
  const [messages, setMessages] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const afterIdRef = useRef(0);

  const canUse = isAuthenticated && (isStudent || isAdmin);

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
    if (open && sessionId) {
      setView("chat");
      // 尝试加载一次消息来验证 Session 有效性
      loadMessages(sessionId).catch(() => {
        handleExit(); // 如果加载失败（如404），退出到列表
      });
    } else if (open) {
      setView("intro");
      fetchGroups();
    }
  }, [open]);

  // --- 业务逻辑：获取小组列表 ---
  const fetchGroups = useCallback(async () => {
    if (!open || view !== "intro") return;
    setGroupsLoading(true);
    try {
      const res = await groupDiscussionApi.listGroups({ keyword: searchKeyword, limit: 100 });
      if (res.success) {
        setGroups(res.data.items || []);
      }
    } finally {
      setGroupsLoading(false);
    }
  }, [open, view, searchKeyword]);

  // 自动刷新：当切换到“加入小组”模式时
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
  const handleJoinOrCreate = async (values: { groupNo: string; groupName?: string }) => {
    try {
      const res = await groupDiscussionApi.join({
        groupNo: values.groupNo,
        groupName: values.groupName,
      });
      
      if (!res.success) {
        message.error(res.message || "操作失败");
        return;
      }

      const { session_id, group_no, group_name } = res.data;
      
      // 更新状态
      setSessionId(session_id);
      setCurrentGroup({ no: group_no, name: group_name || "" });
      
      // 持久化
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, String(session_id));
      localStorage.setItem(STORAGE_KEYS.GROUP_NO, group_no);
      localStorage.setItem(STORAGE_KEYS.GROUP_NAME, group_name || "");
      
      message.success(`成功加入 ${group_no} 组`);
      setView("chat");
      setMessages([]);
      afterIdRef.current = 0;
    } catch (err) {
      console.error(err);
    }
  };

  // --- 业务逻辑：发送消息 ---
  const handleSend = async () => {
    if (!draft.trim() || !sessionId) return;
    
    // 前端冷却校验
    const now = Date.now();
    if (now - lastSendTime < 5000) {
      message.warning(`请等待 ${Math.ceil((5000 - (now - lastSendTime)) / 1000)} 秒后再发送`);
      return;
    }

    setSending(true);
    try {
      const res = await groupDiscussionApi.sendMessage({ sessionId, content: draft });
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
        message.error(res.message);
      }
    } finally {
      setSending(false);
    }
  };

  // --- 业务逻辑：退出小组 ---
  const handleExit = () => {
    setSessionId(null);
    setCurrentGroup({ no: "", name: "" });
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.GROUP_NO);
    localStorage.removeItem(STORAGE_KEYS.GROUP_NAME);
    setView("intro");
    setMessages([]);
    fetchGroups(); // 刷新列表
  };

  // --- 消息加载与轮询 ---
  const loadMessages = async (sid: number) => {
    const res = await groupDiscussionApi.listMessages({
      sessionId: sid,
      afterId: afterIdRef.current,
      limit: 50
    });
    if (res.success && res.data.items.length > 0) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const newItems = res.data.items.filter(m => !ids.has(m.id)).map(m => ({ ...m, is_mine: false })); // is_mine 实际上需要根据当前用户判断，这里简化
        return [...prev, ...newItems].sort((a, b) => a.id - b.id);
      });
      afterIdRef.current = res.data.next_after_id;
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (view !== "chat" || !sessionId) return;
    
    let active = true;
    const poll = async () => {
      if (!active) return;
      await loadMessages(sessionId);
      if (active) setTimeout(poll, 3000);
    };
    poll();
    return () => { active = false; };
  }, [view, sessionId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  // --- 渲染组件 ---

  const renderIntro = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 4px' }}>
      <Segmented
        block
        value={introMode}
        onChange={v => setIntroMode(v as any)}
        options={[
          { label: '加入小组', value: 'join', icon: <TeamOutlined /> },
          { label: '新建小组', value: 'create', icon: <PlusOutlined /> },
        ]}
        style={{ marginBottom: 12 }}
      />

      {introMode === 'join' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索组号或组名..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            style={{ marginBottom: 12 }}
            allowClear
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <List
              dataSource={groups}
              loading={groupsLoading}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无小组，快去新建一个吧" /> }}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => handleJoinOrCreate({ groupNo: item.group_no })}>
                      加入
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.group_no}组</Text>
                        {item.group_name && <Tag>{item.group_name}</Tag>}
                      </Space>
                    }
                    description={
                      <Space split={<Divider type="vertical" />}>
                        <Text type="secondary" style={{ fontSize: 12 }}><UserOutlined /> {item.member_count}人</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.message_count}条消息</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.session_date).format("MM-DD")}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <Form onFinish={handleJoinOrCreate} layout="vertical">
            <Form.Item
              label="组号 (必填)"
              name="groupNo"
              rules={[{ required: true, message: '请输入组号' }, { pattern: /^\d+$/, message: '组号只能包含数字' }]}
              extra="请输入数字组号，如 101"
            >
              <Input placeholder="例如: 101" size="large" />
            </Form.Item>
            <Form.Item
              label="组名 (必填)"
              name="groupName"
              rules={[{ required: true, message: '请输入组名' }]}
              extra="给小组起个好听的名字"
            >
              <Input placeholder="例如: 飞跃小队" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block icon={<PlusOutlined />}>
                立即创建并加入
              </Button>
            </Form.Item>
            <div style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <div style={{ marginBottom: 4 }}>⚠️ 注意事项：</div>
                <div>1. 创建/加入小组后，需等待 3 分钟才能切换其他小组。</div>
                <div>2. 发送消息有 5 秒冷却限制。</div>
              </Text>
            </div>
          </Form>
        </div>
      )}
    </div>
  );

  const renderChat = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 聊天头部 */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#fff'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ fontSize: 16 }}>{currentGroup.no}组</Text>
            {currentGroup.name && <Tag color="blue">{currentGroup.name}</Tag>}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <TeamOutlined /> 正在讨论中
          </Text>
        </div>
        <Button danger size="small" icon={<LogoutOutlined />} onClick={handleExit}>
          切换小组
        </Button>
      </div>

      {/* 消息列表 */}
      <div 
        ref={listRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: 16, 
          background: '#f7f9fc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map(msg => (
          <div key={msg.id} style={{ 
            alignSelf: msg.is_mine ? 'flex-end' : 'flex-start',
            maxWidth: '85%'
          }}>
            <div style={{ 
              fontSize: 12, 
              color: '#999', 
              marginBottom: 4, 
              textAlign: msg.is_mine ? 'right' : 'left',
              padding: '0 4px'
            }}>
              {msg.user_display_name} · {dayjs(msg.created_at).format("HH:mm:ss")}
            </div>
            <div style={{
              padding: '10px 14px',
              background: msg.is_mine ? '#1677ff' : '#fff',
              color: msg.is_mine ? '#fff' : '#333',
              borderRadius: msg.is_mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input 
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onPressEnter={handleSend}
            placeholder="输入消息..." 
            disabled={sending}
          />
          <Button type="primary" onClick={handleSend} loading={sending} disabled={!draft.trim()}>
            发送
          </Button>
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block', textAlign: 'center' }}>
          每 5 秒可发送一条消息
        </Text>
      </div>
    </div>
  );

  // --- 主渲染 ---
  if (!canUse) return null;

  return (
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <div style={{ position: "fixed", left: 0, top: "45%", zIndex: 1000 }}>
          <Button
            type="primary"
            icon={<TeamOutlined />}
            onClick={() => setOpen(true)}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}
          >
            小组讨论
          </Button>
        </div>
      )}

      {/* 悬浮窗口 */}
      {open && (
        <div
          ref={floatingRef}
          style={{
            position: "fixed",
            left: floatingPos.x,
            top: floatingPos.y,
            width: floatingSize.w,
            height: floatingSize.h,
            zIndex: 1050,
            resize: "both",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #d9d9d9",
            display: 'flex',
            flexDirection: 'column'
          }}
          onMouseUp={handleResizeUp}
        >
          {/* 窗口标题栏 */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(to right, #e6f7ff, #ffffff)',
              borderBottom: '1px solid #bae0ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: floatingPinned ? 'default' : 'move' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <TeamOutlined style={{ color: '#1677ff', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16 }}>小组讨论</Text>
            </div>
            <Space size={4} onPointerDown={(e) => e.stopPropagation()}>
              <Tooltip title={floatingPinned ? "取消固定" : "固定窗口"}>
                <Button
                  type="text"
                  size="small"
                  icon={floatingPinned ? <PushpinFilled /> : <PushpinOutlined />}
                  onClick={() => {
                    const next = !floatingPinned;
                    setFloatingPinned(next);
                    localStorage.setItem(STORAGE_KEYS.FLOATING_PINNED, next ? "1" : "0");
                  }}
                />
              </Tooltip>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => { if(view==='intro') fetchGroups(); else loadMessages(sessionId!); }} />
              <Button type="text" size="small" onClick={() => setOpen(false)}>关闭</Button>
            </Space>
          </div>

          {/* 窗口内容区 */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#fff' }}>
            {view === 'intro' ? renderIntro() : renderChat()}
          </div>
        </div>
      )}
    </>
  );
};

export default GroupDiscussionPanel;
