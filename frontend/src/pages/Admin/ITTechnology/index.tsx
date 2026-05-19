import { useNavigate } from "react-router-dom";
import { showMessage } from "@/lib/toast";
import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  ClipboardEdit,
  GitMerge,
  Code,
  Settings,
  Cpu,
  Sparkles,
  Bot,
  BookOpen,
  Brain,
  Wrench,
} from "lucide-react";
import { AdminAppCard, AdminPage } from "@/components/Admin";
import DianmingManager from "./DianmingManager";
import AdminMLPage from "./ml";
import AdminAIPage from "./ai";
import AdminAgentsPage from "./agents";
import AgentConfigModal from "./components/AgentConfigModal";
import MindMapManager from "./learning/MindMapManager";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { logger } from "@services/logger";

type ViewState = 'dashboard' | 'dianming-manager' | 'ml-manager' | 'ai-manager' | 'agents-manager' | 'mindmap-manager';

const AdminITTechnology: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('dashboard');
  const [agentConfigVisible, setAgentConfigVisible] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const appConfigs = [
    { key: 'it_dianming', title: '随机点名', description: '班级名单管理与随机抽取工具', icon: <FlaskConical className="h-4 w-4" />, color: "var(--ws-color-primary)", category: '教学工具', hasManager: true },
    { key: 'it_survey', title: '问卷调查', description: '在线问卷创建与数据收集分析', icon: <ClipboardEdit className="h-4 w-4" />, color: "var(--ws-color-warning)", category: '教学工具', hasManager: false },
    { key: 'it_mindmap', title: '思维导图', description: '在线脑图编辑与知识梳理', icon: <GitMerge className="h-4 w-4" />, color: "var(--ws-color-success)", category: '教学工具', hasManager: true },
    { key: 'it_python_lab', title: 'Python 实验室', description: '实验模板管理与前台实验台入口', icon: <Code className="h-4 w-4" />, color: "var(--ws-color-info)", category: '教学工具', hasManager: true, managerLabel: "管理智能体" },
    { key: 'it_machine_learning', title: '机器学习', description: '模型训练与实验平台', icon: <Cpu className="h-4 w-4" />, color: "var(--ws-color-purple)", category: 'AI 与编程', hasManager: true },
    { key: 'it_ai_exploration', title: '人工智能探索', description: 'AI 能力体验与交互式学习', icon: <Sparkles className="h-4 w-4" />, color: "var(--ws-tag-blue)", category: 'AI 与编程', hasManager: true },
    { key: 'it_agent_exploration', title: '智能体探索', description: '多智能体协作与对话实验', icon: <Bot className="h-4 w-4" />, color: "var(--ws-color-primary)", category: 'AI 与编程', hasManager: true },
    { key: 'it_game_lock_cracker', title: '密码锁破解', description: '教学互动小游戏 · 密码锁破解等', icon: <FlaskConical className="h-4 w-4" />, color: "var(--ws-tag-blue)", category: '小游戏', hasManager: true, managerLabel: "打开" },
  ];

  const categories = [...new Set(appConfigs.map(a => a.category))];

  const fetchFlags = async () => {
    try {
      const res = await featureFlagsApi.list();
      const newFlags: Record<string, boolean> = {};
      res.forEach(f => {
        newFlags[f.key] = f.value?.enabled === true;
      });
      setFlags(newFlags);
    } catch (error) {
      logger.error("Failed to fetch feature flags", error);
    }
  };

  useEffect(() => {
    void fetchFlags();
  }, []);

  const handleToggle = async (key: string, checked: boolean) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await featureFlagsApi.save({
        key: `${key}_enabled`,
        value: { enabled: checked }
      });
      setFlags(prev => ({ ...prev, [`${key}_enabled`]: checked }));
      showMessage.success(`${checked ? '已启用' : '已禁用'}应用`);
    } catch (_error) {
      showMessage.error("操作失败");
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  if (view === 'dianming-manager') {
    return (
      <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
        <div className="mb-4 shrink-0">
          <Button variant="link" onClick={() => setView('dashboard')} className="!p-0 text-text-secondary">
            ← 返回 IT 应用管理
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <DianmingManager />
        </div>
      </AdminPage>
    );
  }

  if (view === 'ml-manager') {
    const links = [
      { icon: <BookOpen className="h-5 w-5" />, label: '学习书（章节）', href: '/admin/it-technology/learning/ml' },
      { icon: <Brain className="h-5 w-5" />, label: '学习地图', href: '/admin/it-technology/mindmap/ml' },
      { icon: <FlaskConical className="h-5 w-5" />, label: '动手实验', href: '/admin/it-technology/learning/ml/experiments' },
      { icon: <Wrench className="h-5 w-5" />, label: '工具箱', href: '/admin/it-technology/learning/ml/tools' },
    ];
    return (
      <AdminPage padding="var(--ws-panel-padding)" scrollable={true}>
        <div className="mb-4">
          <Button variant="link" onClick={() => setView('dashboard')} className="!p-0 text-text-secondary">
            ← 返回 IT 应用管理
          </Button>
        </div>
        <h2 className="text-lg font-bold mb-4">机器学习 · 内容管理</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(l => (
            <a key={l.href} href={l.href} target="_blank"
              className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-[var(--ws-color-primary-muted)] transition-colors no-underline">
              <span className="text-primary">{l.icon}</span>
              <span className="text-sm font-medium text-text-base">{l.label}</span>
            </a>
          ))}
        </div>
      </AdminPage>
    );
  }

  if (view === 'ai-manager' || view === 'agents-manager') {
    const mod = view === 'ai-manager' ? 'ai' : 'agents';
    const label = view === 'ai-manager' ? '人工智能探索' : '智能体探索';
    const links = [
      { icon: <BookOpen className="h-5 w-5" />, label: '学习书（章节）', href: `/admin/it-technology/learning/${mod}` },
      { icon: <Brain className="h-5 w-5" />, label: '学习地图', href: `/admin/it-technology/mindmap/${mod}` },
      { icon: <FlaskConical className="h-5 w-5" />, label: '动手实验', href: `/admin/it-technology/learning/${mod}/experiments` },
      { icon: <Wrench className="h-5 w-5" />, label: '工具箱', href: `/admin/it-technology/learning/${mod}/tools` },
    ];
    return (
      <AdminPage padding="var(--ws-panel-padding)" scrollable={true}>
        <div className="mb-4">
          <Button variant="link" onClick={() => setView('dashboard')} className="!p-0 text-text-secondary">
            ← 返回 IT 应用管理
          </Button>
        </div>
        <h2 className="text-lg font-bold mb-4">{label} · 内容管理</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(l => (
            <a key={l.href} href={l.href} target="_blank"
              className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-[var(--ws-color-primary-muted)] transition-colors no-underline">
              <span className="text-primary">{l.icon}</span>
              <span className="text-sm font-medium text-text-base">{l.label}</span>
            </a>
          ))}
        </div>
      </AdminPage>
    );
  }

  if (view === 'mindmap-manager') {
    return (
      <AdminPage padding="var(--ws-panel-padding)" scrollable={false}>
        <MindMapManager />
      </AdminPage>
    );
  }

  return (
    <AdminPage padding="var(--ws-panel-padding)">
      {categories.map(cat => (
        <div key={cat} className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-text-tertiary">{cat}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {appConfigs.filter(a => a.category === cat).map(app => (
              <div key={app.key}>
                <AdminAppCard
                  title={app.title}
                  description={app.description}
                  icon={app.icon}
                  enabled={flags[`${app.key}_enabled`] || false}
                  loading={loading[app.key]}
                  onToggle={(checked) => handleToggle(app.key, checked)}
                  color={app.color}
                  actionLabel={(app as any).managerLabel || (app.hasManager ? "管理" : undefined)}
                  actionIcon={app.hasManager ? <Settings className="h-4 w-4" /> : undefined}
                  onAction={
                    app.hasManager
                      ? () => {
                          if (app.key === "it_dianming") setView("dianming-manager");
                          if (app.key === "it_python_lab") setAgentConfigVisible(true);
                          if (app.key === "it_machine_learning") navigate("/admin/it-technology/ml-book-editor");
                          if (app.key === "it_ai_exploration") setView("ai-manager");
                          if (app.key === "it_agent_exploration") setView("agents-manager");
                          if (app.key === "it_mindmap") setView("mindmap-manager");
                          if (app.key === "it_game_lock_cracker") window.open("/admin/games/config", "_blank");
                        }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <AgentConfigModal visible={agentConfigVisible} onClose={() => setAgentConfigVisible(false)} />
    </AdminPage>
  );
};

export default AdminITTechnology;
