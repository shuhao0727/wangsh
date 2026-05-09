import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home, RotateCcw,
  Volume2, Code, FileText, GitBranch, ChevronRight, TriangleAlert,
  Cpu, Sparkles, Network
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RollCallPlayer from './RollCallPlayer';
import ClassSelector from './ClassSelector';
import type { DianmingClass } from '@/services/xxjs/dianming';
import { featureFlagsApi } from '@/services/system/featureFlags';
import { api } from '@services';
import { logger } from '@services/logger';
import EmptyState from "@components/Common/EmptyState";
import AppLauncherCard from "@components/Common/AppLauncherCard";
import './ITTechnology.css';

type ViewState = 'launcher' | 'rollcall-selector' | 'rollcall-player';

const APPS = [
  {
    key: 'it_dianming_enabled',
    title: '随机点名',
    description: '随机抽取学生，支持名单导入。',
    icon: <Volume2 className="h-5 w-5" />,
    color: 'var(--ws-color-primary)', bg: 'color-mix(in srgb, var(--ws-color-primary) 8%, transparent)', ring: 'color-mix(in srgb, var(--ws-color-primary) 22%, transparent)',
    action: 'dianming',
    available: true,
  },
  {
    key: 'it_python_lab_enabled',
    title: 'Python 实验室',
    description: '在线编程与流程可视化。',
    icon: <Code className="h-5 w-5" />,
    color: 'var(--ws-color-success)', bg: 'color-mix(in srgb, var(--ws-color-success) 8%, transparent)', ring: 'color-mix(in srgb, var(--ws-color-success) 22%, transparent)',
    action: 'python',
    available: true,
  },
  {
    key: 'it_survey_enabled',
    title: '问卷调查',
    description: '在线发放问卷并收集反馈。',
    icon: <FileText className="h-5 w-5" />,
    color: 'var(--ws-color-purple)', bg: 'color-mix(in srgb, var(--ws-color-purple) 8%, transparent)', ring: 'color-mix(in srgb, var(--ws-color-purple) 22%, transparent)',
    action: 'survey',
    available: false,
  },
  {
    key: 'it_mindmap_enabled',
    title: '思维导图',
    description: '在线绘制导图与流程图。',
    icon: <GitBranch className="h-5 w-5" />,
    color: 'var(--ws-color-warning)', bg: 'color-mix(in srgb, var(--ws-color-warning) 8%, transparent)', ring: 'color-mix(in srgb, var(--ws-color-warning) 22%, transparent)',
    action: 'mindmap',
    available: false,
  },
  {
    key: 'it_machine_learning_enabled',
    title: '机器学习',
    description: '17 章学习书 · 5 阶段路线 · 9 大知识域 · 14 个实验',
    icon: <Cpu className="h-5 w-5" />,
    color: '#8B5CF6', bg: 'color-mix(in srgb, #8B5CF6 8%, transparent)', ring: 'color-mix(in srgb, #8B5CF6 22%, transparent)',
    action: 'ml',
    available: true,
  },
  {
    key: 'it_ai_exploration_enabled',
    title: '人工智能探索',
    description: '14 章学习书 · 6 阶段路线 · 8 大 AI 领域 · 14 项提示技术',
    icon: <Sparkles className="h-5 w-5" />,
    color: '#06B6D4', bg: 'color-mix(in srgb, #06B6D4 8%, transparent)', ring: 'color-mix(in srgb, #06B6D4 22%, transparent)',
    action: 'ai',
    available: true,
  },
  {
    key: 'it_agent_exploration_enabled',
    title: '智能体探索',
    description: '13 章学习书 · 5 阶段路线 · 13 种框架 · 16 个动手实验',
    icon: <Network className="h-5 w-5" />,
    color: '#10B981', bg: 'color-mix(in srgb, #10B981 8%, transparent)', ring: 'color-mix(in srgb, #10B981 22%, transparent)',
    action: 'agents',
    available: true,
  },
];

const ITTechnologyPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('launcher');
  const [currentClass, setCurrentClass] = useState<DianmingClass | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<Record<string, { overall: number; label: string }>>({});

  const loadFlags = async () => {
    setLoading(true); setError(null);
    try {
      const keys = ['it_dianming_enabled', 'it_survey_enabled', 'it_mindmap_enabled', 'it_python_lab_enabled', 'it_machine_learning_enabled', 'it_ai_exploration_enabled', 'it_agent_exploration_enabled'];
      const results = await Promise.all(
        keys.map(key => featureFlagsApi.getPublic(key).catch(() => ({ value: { enabled: false } } as any)))
      );
      const newFlags: Record<string, boolean> = {};
      results.forEach((res, i) => {
        const k = keys[i];
        const enabled = res.value?.enabled === true;
        if (!enabled && k === 'it_python_lab_enabled' && process.env.REACT_APP_ENV === 'development') {
          newFlags[k] = res.value?.enabled !== false;
          return;
        }
        newFlags[k] = enabled;
      });
      setFlags(newFlags);

      // Fetch learning progress for enabled modules
      const moduleMap: Record<string, string> = {
        it_machine_learning_enabled: 'ml',
        it_ai_exploration_enabled: 'ai',
        it_agent_exploration_enabled: 'agents',
      };
      const enabledLearningKeys = Object.keys(moduleMap).filter(k => newFlags[k]);
      if (enabledLearningKeys.length > 0) {
        const progressResults = await Promise.allSettled(
          enabledLearningKeys.map(key =>
            api.get(`/learning/progress/${moduleMap[key]}`).catch(() => null)
          )
        );
        const newProgress: Record<string, { overall: number; label: string }> = {};
        progressResults.forEach((result, i) => {
          const data = (result.status === 'fulfilled' ? result.value?.data?.data : undefined) as
            | { overall_progress?: number; total_completed?: number; total_items?: number }
            | undefined;
          if (data && data.overall_progress !== undefined) {
            newProgress[enabledLearningKeys[i]] = {
              overall: data.overall_progress ?? 0,
              label: `已完成 ${data.total_completed ?? 0}/${data.total_items ?? '?'} 项`,
            };
          }
        });
        setProgressData(newProgress);
      }
    } catch (e: any) {
      logger.error(e);
      setError(e?.message || '加载配置失败，请检查网络或刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadFlags(); }, []);

  const handleSelectClass = (record: DianmingClass) => {
    setCurrentClass(record); setView('rollcall-player');
  };

  const renderBreadcrumb = () => {
    const crumbs = [
      {
        key: "home",
        label: "首页",
        onClick: () => {
          setView('launcher');
          setCurrentClass(null);
        },
        icon: <Home className="h-4 w-4" />,
      },
      ...(view !== 'launcher'
        ? [
            {
              key: "dianming",
              label: "随机点名",
              onClick: () => {
                setView('rollcall-selector');
                setCurrentClass(null);
              },
            },
          ]
        : []),
      ...(view === 'rollcall-player' && currentClass
        ? [{ key: "class", label: currentClass.class_name }]
        : []),
    ];

    return (
      <div className="mb-3 flex items-center gap-1 text-sm text-text-secondary">
        {crumbs.map((item, idx) => (
          <React.Fragment key={item.key}>
            {idx > 0 ? <ChevronRight className="h-4 w-4 text-text-tertiary" /> : null}
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="appearance-none border-0 inline-flex items-center gap-1 rounded-md px-[var(--ws-space-1)] py-[calc(var(--ws-space-1)/2)] text-sm transition-colors hover:bg-primary-soft hover:text-primary"
              >
                {item.icon}
                {item.label}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-text-base">{item.icon}{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (view === 'rollcall-player' && currentClass) {
    return <RollCallPlayer record={currentClass} onBack={() => { setView('rollcall-selector'); setCurrentClass(null); }} />;
  }

  if (loading) {
    return (
      <div className="it-technology-page w-full flex-1 mx-auto px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
        <div className="grid gap-[var(--ws-layout-gap)]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl p-[var(--ws-panel-padding)] bg-surface-2 space-y-[var(--ws-space-2)]">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-8/12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="it-technology-page w-full flex-1 mx-auto px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
        <Alert variant="destructive" className="border border-destructive/20 bg-destructive/5">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-[var(--ws-space-2)]">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadFlags}>
              <RotateCcw className="h-4 w-4" />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const visibleApps = APPS.filter(app => flags[app.key]);
  const learningAppKeys = new Set(['it_machine_learning_enabled', 'it_ai_exploration_enabled', 'it_agent_exploration_enabled']);
  const utilityApps = visibleApps.filter(app => !learningAppKeys.has(app.key));
  const learningApps = visibleApps.filter(app => learningAppKeys.has(app.key));

  const renderCard = (app: typeof APPS[number]) => {
    const progress = progressData[app.key];
    return (
      <AppLauncherCard
        key={app.key}
        title={app.title}
        description={app.description}
        icon={app.icon}
        color={app.color}
        bg={app.bg}
        ring={app.ring}
        disabled={!app.available}
        progress={progress?.overall}
        progressLabel={progress?.label}
        onClick={() => {
          if (app.action === 'dianming') setView('rollcall-selector');
          if (app.action === 'python') void navigate('/it-technology/python-lab');
          if (app.action === 'ml') window.open('/it-technology/ml', '_blank');
          if (app.action === 'ai') window.open('/it-technology/ai', '_blank');
          if (app.action === 'agents') window.open('/it-technology/agents', '_blank');
        }}
      />
    );
  };

  return (
    <div className="it-technology-page w-full flex-1 mx-auto px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)] flex flex-col" style={{ maxWidth: "var(--ws-shell-max-width)" }}>
      {view === 'launcher' ? (
        <>
          {visibleApps.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <EmptyState description="暂无可用应用，请联系管理员在后台开启。" />
            </div>
          ) : (
            <div className="space-y-[var(--ws-layout-gap)]">
              {utilityApps.length > 0 && (
                <div className="grid gap-[var(--ws-layout-gap)]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {utilityApps.map(renderCard)}
                </div>
              )}
              {learningApps.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary whitespace-nowrap">AI 学习系列</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-[var(--ws-layout-gap)]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {learningApps.map(renderCard)}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col flex-1">
          {renderBreadcrumb()}
          <div className="flex-1 rounded-xl bg-surface p-[var(--ws-panel-padding)]">
            <ClassSelector onSelect={handleSelectClass} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ITTechnologyPage;
