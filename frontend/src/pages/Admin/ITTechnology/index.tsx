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
    {
      key: 'it_dianming',
      title: '随机点名',
      description: '班级名单管理与随机抽取工具',
      icon: <FlaskConical className="h-5 w-5" />,
      color: "var(--ws-color-primary)",
      hasManager: true,
    },
    {
      key: 'it_python_lab',
      title: 'Python 实验室',
      description: '实验模板管理与前台实验台入口',
      icon: <Code className="h-5 w-5" />,
      color: "var(--ws-color-info)",
      hasManager: true,
      managerLabel: "管理智能体",
    },
    {
      key: 'it_survey',
      title: '问卷调查',
      description: '在线问卷创建与数据收集分析',
      icon: <ClipboardEdit className="h-5 w-5" />,
      color: "var(--ws-color-warning)",
      hasManager: false, // 暂未实现
    },
    {
      key: 'it_mindmap',
      title: '思维导图',
      description: '在线脑图编辑与知识梳理',
      icon: <GitMerge className="h-5 w-5" />,
      color: "var(--ws-color-success)",
      hasManager: true,
    },
    {
      key: 'it_machine_learning',
      title: '机器学习',
      description: '机器学习模型训练与实验平台',
      icon: <Cpu className="h-5 w-5" />,
      color: "#8B5CF6",
      hasManager: true,
    },
    {
      key: 'it_ai_exploration',
      title: '人工智能探索',
      description: 'AI 能力体验与交互式学习探索',
      icon: <Sparkles className="h-5 w-5" />,
      color: "#2563EB",
      hasManager: true,
    },
    {
      key: 'it_agent_exploration',
      title: '智能体探索',
      description: '多智能体协作与对话实验',
      icon: <Bot className="h-5 w-5" />,
      color: "#0D9488",
      hasManager: true,
    },
  ];

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
      { label: '📖 学习书（章节）', href: '/admin/it-technology/learning/ml' },
      { label: '🧠 学习地图', href: '/admin/it-technology/mindmap/ml' },
      { label: '🔬 动手实验', href: '/admin/it-technology/learning/ml/experiments' },
      { label: '🔧 工具箱', href: '/admin/it-technology/learning/ml/tools' },
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
              className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors no-underline">
              <span className="text-2xl">{l.label.slice(0, 2)}</span>
              <span className="text-sm font-medium text-text-base">{l.label.slice(3)}</span>
              <span className="ml-auto text-xs text-text-tertiary">→</span>
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
      { label: '📖 学习书（章节）', href: `/admin/it-technology/learning/${mod}` },
      { label: '🧠 学习地图', href: `/admin/it-technology/mindmap/${mod}` },
      { label: '🔬 动手实验', href: `/admin/it-technology/learning/${mod}/experiments` },
      { label: '🔧 工具箱', href: `/admin/it-technology/learning/${mod}/tools` },
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
              className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent transition-colors no-underline">
              <span className="text-2xl">{l.label.slice(0, 2)}</span>
              <span className="text-sm font-medium text-text-base">{l.label.slice(3)}</span>
              <span className="ml-auto text-xs text-text-tertiary">→</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {appConfigs.map(app => (
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
                    }
                  : undefined
              }
            />
          </div>
        ))}
      </div>
      <AgentConfigModal visible={agentConfigVisible} onClose={() => setAgentConfigVisible(false)} />
    </AdminPage>
  );
};

export default AdminITTechnology;
