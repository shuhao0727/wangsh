import { showMessage } from "@/lib/toast";
import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  ClipboardEdit,
  GitMerge,
  Code,
  Settings,
} from "lucide-react";
import { AdminAppCard, AdminPage } from "@/components/Admin";
import DianmingManager from "./DianmingManager";
import AgentConfigModal from "./components/AgentConfigModal";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { logger } from "@services/logger";

type ViewState = 'dashboard' | 'dianming-manager';

const AdminITTechnology: React.FC = () => {
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
      hasManager: false, // 暂未实现
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
    fetchFlags();
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
