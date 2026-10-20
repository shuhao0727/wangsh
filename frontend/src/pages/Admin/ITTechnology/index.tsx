import { useNavigate, useSearchParams } from "react-router-dom";
import { showMessage } from "@/lib/toast";
import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  FlaskConical,
  ClipboardEdit,
  GitMerge,
  Code,
  ChevronRight,
  Cpu,
  Sparkles,
  Bot,
  BookOpen,
  Brain,
  Wrench,
  Gamepad2,
  Shuffle,
  LockKeyhole,
  ClipboardList,
} from "lucide-react";
import { AdminPage } from "@/components/Admin";
import DianmingManager from "./DianmingManager";
import AgentConfigModal from "./components/AgentConfigModal";
import MindMapManager from "./learning/MindMapManager";
import KnnManager from "./KnnManager";
import { featureFlagsApi } from "@/services/system/featureFlags";
import { logger } from "@services/logger";
import useAuth from "@hooks/useAuth";
import { canManageITGameRepo } from "@components/Auth/ITGamesAccess";
import { canAccessRoles, canManageFeatureFlags, IT_TECHNOLOGY_MANAGEMENT_ROLES } from "@components/Auth/roleAccess";

type ViewState = 'dashboard' | 'dianming-manager' | 'ml-manager' | 'ai-manager' | 'agents-manager' | 'mindmap-manager';

type AppConfig = {
  key: string;
  title: string;
  icon: React.ReactNode;
  category: string;
  hasManager: boolean;
  managerLabel?: string;
  hasFeatureFlag?: boolean;
  actionHref?: string;
};

const appConfigs: AppConfig[] = [
  { key: 'it_ai_partner', title: '召唤一名AI同学', icon: <Sparkles className="h-4 w-4" />, category: '公开课', hasManager: false, hasFeatureFlag: false, actionHref: '/games/ai-partner/index.html', managerLabel: '打开' },
  { key: 'it_game_lock_cracker', title: '密码锁破解', icon: <LockKeyhole className="h-4 w-4" />, category: '公开课', hasManager: true, managerLabel: "密码配置" },
  { key: 'it_knn', title: 'KNN 运动习惯采集', icon: <ClipboardList className="h-4 w-4" />, category: '公开课', hasManager: true, hasFeatureFlag: false },
  { key: 'it_dianming', title: '随机点名', icon: <Shuffle className="h-4 w-4" />, category: '课堂工具', hasManager: true },
  { key: 'it_survey', title: '问卷调查', icon: <ClipboardEdit className="h-4 w-4" />, category: '课堂工具', hasManager: false },
  { key: 'it_mindmap', title: '思维导图', icon: <GitMerge className="h-4 w-4" />, category: '课堂工具', hasManager: true },
  { key: 'it_python_lab', title: 'Python 实验室', icon: <Code className="h-4 w-4" />, category: 'AI 与编程', hasManager: true, managerLabel: "智能体配置" },
  { key: 'it_machine_learning', title: '机器学习', icon: <Cpu className="h-4 w-4" />, category: 'AI 与编程', hasManager: true },
  { key: 'it_ai_exploration', title: '人工智能探索', icon: <Sparkles className="h-4 w-4" />, category: 'AI 与编程', hasManager: true },
  { key: 'it_agent_exploration', title: '智能体探索', icon: <Bot className="h-4 w-4" />, category: 'AI 与编程', hasManager: true },
  { key: 'it_game_repo', title: '游戏资源库', icon: <Gamepad2 className="h-4 w-4" />, category: '游戏与资源', hasManager: true, managerLabel: "管理" },
];
const appGroups = ['公开课', '课堂工具', 'AI 与编程', '游戏与资源'];
const flaggedApps = appConfigs.filter(app => app.hasFeatureFlag !== false);

const AdminITTechnology: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const auth = useAuth();
  const [view, setView] = useState<ViewState>('dashboard');
  const [agentConfigVisible, setAgentConfigVisible] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagLoadError, setFlagLoadError] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const canToggleFlags = canManageFeatureFlags(auth.user?.role_code);
  const canManageApps = canAccessRoles(auth.user?.role_code, IT_TECHNOLOGY_MANAGEMENT_ROLES);

  useEffect(() => {
    if (!canManageApps) return;
    let cancelled = false;
    const loadFlags = async () => {
      setFlagLoadError("");
      try {
        const newFlags: Record<string, boolean> = {};
        if (canToggleFlags) {
          const results = await featureFlagsApi.list();
          if (cancelled) return;
          results.forEach((flag) => {
            newFlags[flag.key] = flag.value?.enabled === true;
          });
        } else {
          const results = await Promise.allSettled(
            flaggedApps.map((app) =>
              featureFlagsApi.getPublic(`${app.key}_enabled`),
            ),
          );
          if (cancelled) return;
          let failedCount = 0;
          results.forEach((result, index) => {
            if (result.status === "fulfilled") {
              newFlags[result.value.key] = result.value.value?.enabled === true;
            } else {
              failedCount += 1;
              logger.error(
                `Failed to fetch feature flag ${flaggedApps[index].key}_enabled`,
                result.reason,
              );
            }
          });
          if (failedCount > 0) {
            setFlagLoadError(
              failedCount === results.length
                ? "功能开关加载失败，请刷新页面后重试。"
                : "部分功能开关加载失败，未加载的应用状态暂不可用。",
            );
          }
        }
        setFlags((previous) => ({ ...previous, ...newFlags }));
      } catch (error) {
        logger.error("Failed to fetch feature flags", error);
        if (!cancelled) {
          setFlagLoadError("功能开关加载失败，请刷新页面后重试。");
        }
      }
    };
    void loadFlags();
    return () => {
      cancelled = true;
    };
  }, [canManageApps, canToggleFlags]);

  const handleToggle = async (key: string, checked: boolean) => {
    if (!canToggleFlags) return;
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

  if (params.get('view') === 'knn') {
    return <AdminPage padding="var(--ws-panel-padding)" maxWidth={1320}>
      <KnnManager backLabel={canManageApps ? "IT 应用" : "管理首页"} onBack={() => {
        if (!canManageApps) {
          void navigate("/admin/dashboard");
          return;
        }
        setView('dashboard');
        setParams(previous => {
          const next = new URLSearchParams(previous);
          next.delete('view');
          next.delete('batch');
          return next;
        });
      }} />
    </AdminPage>;
  }

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
        <h2 className="mb-3 text-base font-semibold text-text-base">机器学习 · 内容管理</h2>
        <div className="ws-it-admin-manager-links">
          {links.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              className="ws-it-admin-manager-link flex items-center gap-3 transition-colors no-underline hover:bg-primary-soft">
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
        <div className="mb-3">
          <Button variant="link" onClick={() => setView('dashboard')} className="!p-0 text-text-secondary">
            ← 返回 IT 应用管理
          </Button>
        </div>
        <h2 className="mb-3 text-base font-semibold text-text-base">{label} · 内容管理</h2>
        <div className="ws-it-admin-manager-links">
          {links.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              className="ws-it-admin-manager-link flex items-center gap-3 transition-colors no-underline hover:bg-primary-soft">
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

  const openManager = (key: string) => {
    if (key === "it_knn") setParams({ view: "knn" });
    const app = appConfigs.find(item => item.key === key);
    if (app?.actionHref) window.open(app.actionHref, "_blank", "noopener,noreferrer");
    if (key === "it_dianming") setView("dianming-manager");
    if (key === "it_python_lab") setAgentConfigVisible(true);
    if (key === "it_machine_learning") void navigate("/admin/it-technology/ml-book-editor");
    if (key === "it_ai_exploration") setView("ai-manager");
    if (key === "it_agent_exploration") setView("agents-manager");
    if (key === "it_mindmap") setView("mindmap-manager");
    if (key === "it_game_lock_cracker") window.open("/admin/games/config", "_blank");
    if (key === "it_game_repo") void navigate("/admin/it-technology/games");
  };

  return (
    <AdminPage padding="var(--ws-panel-padding)" maxWidth={1320}>
      <div className="ws-it-app-catalog">
        <header className="ws-it-catalog-heading">
          <h1>应用管理</h1>
          <span>{appConfigs.length} 项应用</span>
        </header>
        {flagLoadError && (
          <div role="alert" className="rounded-md border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {flagLoadError}
          </div>
        )}
        {appGroups.map((group, index) => <section key={group} aria-labelledby={`it-group-${index}`}>
          <h2 id={`it-group-${index}`} className="mb-2 text-sm font-semibold text-text-secondary">{group}</h2>
          <ul className="ws-it-catalog-grid" aria-label={group}>
          {appConfigs.filter(app => app.category === group).map(app => {
            const flagKey = `${app.key}_enabled`;
            const stateKnown = Object.prototype.hasOwnProperty.call(flags, flagKey);
            const enabled = flags[flagKey] === true;
            const showManagerAction = (app.hasManager || !!app.actionHref) &&
              (app.key !== "it_game_repo" || canManageITGameRepo(auth.user?.role_code));
            return (
              <li key={app.key} className="ws-it-app-tile" aria-labelledby={`${app.key}-title`}>
                <div className="ws-it-tile-content">
                  <span className="ws-it-tile-symbol" aria-hidden="true">{app.icon}</span>
                  <h3 id={`${app.key}-title`}>{app.title}</h3>
                </div>
                <div className="ws-it-tile-footer">
                  {app.hasFeatureFlag === false ? <span className="text-xs text-text-secondary">免登录</span> : <div className="ws-it-tile-visibility">
                    <span className="ws-it-tile-visibility-label">前台入口</span>
                    {canToggleFlags && (
                      <Switch
                        className="ws-it-entry-switch"
                        aria-label={`${app.title}前台入口`}
                        checked={enabled}
                        disabled={!stateKnown || !!loading[app.key]}
                        onCheckedChange={(checked) => void handleToggle(app.key, checked)}
                      />
                    )}
                    <span className={stateKnown && canToggleFlags ? "sr-only" : "text-text-secondary"}>
                      {stateKnown ? (enabled ? "已启用" : "已禁用") : "未获取"}
                    </span>
                  </div>}
                  {showManagerAction && (
                    <Button variant="ghost" size="sm" className="ws-it-tile-action"
                      aria-label={`${app.title}${app.managerLabel || "管理"}`}
                      onClick={() => openManager(app.key)}>
                      {app.managerLabel || "管理"}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        </section>)}
        <AgentConfigModal visible={agentConfigVisible} onClose={() => setAgentConfigVisible(false)} />
      </div>
    </AdminPage>
  );
};

export default AdminITTechnology;
