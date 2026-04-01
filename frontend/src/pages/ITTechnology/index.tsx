import React, { useState, useEffect } from 'react';
import { Breadcrumb, Alert, Button, Skeleton } from 'antd';
import {
  HomeOutlined, ReloadOutlined, ArrowRightOutlined,
  SoundOutlined, CodeOutlined, FormOutlined, BranchesOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import RollCallPlayer from './RollCallPlayer';
import ClassSelector from './ClassSelector';
import { DianmingClass } from '@/services/xxjs/dianming';
import { featureFlagsApi } from '@/services/system/featureFlags';
import { logger } from '@services/logger';
import EmptyState from "@components/Common/EmptyState";
import './ITTechnology.css';

type ViewState = 'launcher' | 'rollcall-selector' | 'rollcall-player';

const APPS = [
  {
    key: 'it_dianming_enabled',
    title: '随机点名',
    description: '公平公正的随机抽取工具，支持班级名单导入与特效展示。',
    icon: <SoundOutlined />,
    color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', ring: 'rgba(14,165,233,0.2)',
    action: 'dianming',
    available: true,
  },
  {
    key: 'it_python_lab_enabled',
    title: 'Python 实验室',
    description: '在线 Python 编程环境，可视化流程图与代码执行。',
    icon: <CodeOutlined />,
    color: '#10B981', bg: 'rgba(16,185,129,0.08)', ring: 'rgba(16,185,129,0.2)',
    action: 'python',
    available: true,
  },
  {
    key: 'it_survey_enabled',
    title: '问卷调查',
    description: '创建与分发在线问卷，实时收集学生反馈数据。',
    icon: <FormOutlined />,
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', ring: 'rgba(139,92,246,0.2)',
    action: 'survey',
    available: false,
  },
  {
    key: 'it_mindmap_enabled',
    title: '思维导图',
    description: '结构化您的创意，在线绘制流程图与知识图谱。',
    icon: <BranchesOutlined />,
    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', ring: 'rgba(245,158,11,0.2)',
    action: 'mindmap',
    available: false,
  },
];

const ITTechnologyPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('launcher');
  const [currentClass, setCurrentClass] = useState<DianmingClass | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = async () => {
    setLoading(true); setError(null);
    try {
      const keys = ['it_dianming_enabled', 'it_survey_enabled', 'it_mindmap_enabled', 'it_python_lab_enabled'];
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
    } catch (e: any) {
      logger.error(e);
      setError(e?.message || '加载配置失败，请检查网络或刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFlags(); }, []);

  const handleSelectClass = (record: DianmingClass) => {
    setCurrentClass(record); setView('rollcall-player');
  };

  const renderBreadcrumb = () => (
    <Breadcrumb className="mb-4"
      items={[
        {
          title: <><HomeOutlined /> 首页</>,
          href: "#",
          onClick: (e) => { e.preventDefault(); setView('launcher'); setCurrentClass(null); }
        },
        ...(view !== 'launcher' ? [{
          title: '随机点名', href: "#",
          onClick: (e: React.MouseEvent) => { e.preventDefault(); setView('rollcall-selector'); setCurrentClass(null); }
        }] : []),
        ...(view === 'rollcall-player' && currentClass ? [{ title: currentClass.class_name }] : [])
      ]}
    />
  );

  if (view === 'rollcall-player' && currentClass) {
    return <RollCallPlayer record={currentClass} onBack={() => { setView('rollcall-selector'); setCurrentClass(null); }} />;
  }

  if (loading) {
    return (
      <div className="w-full flex-1 mx-auto px-6 py-8" style={{ maxWidth: "var(--ws-page-max-width-wide)" }}>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {[1,2,3,4].map(i => <div key={i} className="rounded-2xl p-6 bg-surface-2"><Skeleton active /></div>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex-1 mx-auto px-6 py-8" style={{ maxWidth: "var(--ws-page-max-width-wide)" }}>
        <Alert type="error" message="加载失败" description={error} showIcon
          action={<Button size="small" type="primary" onClick={loadFlags} icon={<ReloadOutlined />}>重试</Button>}
        />
      </div>
    );
  }

  const visibleApps = APPS.filter(app => flags[app.key]);

  return (
    <div className="w-full flex-1 mx-auto px-6 py-8 flex flex-col" style={{ maxWidth: "var(--ws-page-max-width-wide)" }}>
      {view === 'launcher' ? (
        <>
          {visibleApps.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <EmptyState description="暂无可用应用，请联系管理员在后台开启。" />
            </div>
          ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {visibleApps.map(app => (
                <button
                  key={app.key}
                  className="it-app-card relative flex flex-col items-center text-center rounded-2xl px-5 py-5 border-0 cursor-pointer w-full bg-surface-2"
                  style={{ '--app-bg': app.bg, '--app-ring': app.ring } as React.CSSProperties}
                  onClick={() => {
                    if (!app.available) return;
                    if (app.action === 'dianming') setView('rollcall-selector');
                    if (app.action === 'python') navigate('/it-technology/python-lab');
                  }}
                >
                  {/* 图标 */}
                  <div className="it-app-icon flex items-center justify-center w-14 h-14 rounded-2xl mb-3 transition-transform duration-150 text-xl"
                    style={{ background: app.bg, color: app.color }}>
                    {app.icon}
                  </div>
                  {/* 标题 */}
                  <div className="font-semibold text-base text-text-base mb-2">{app.title}</div>
                  {/* 描述 */}
                  <div className="text-sm text-text-secondary leading-relaxed mb-3">{app.description}</div>
                  {/* 按钮 */}
                  {app.available ? (
                    <div className="flex items-center gap-1 text-sm font-medium" style={{ color: app.color }}>
                      立即使用 <ArrowRightOutlined className="it-app-arrow text-xs transition-transform duration-150" />
                    </div>
                  ) : (
                    <div className="text-xs text-text-tertiary">敬请期待</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col flex-1">
          {renderBreadcrumb()}
          <div className="flex-1 rounded-2xl bg-white p-6">
            <ClassSelector onSelect={handleSelectClass} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ITTechnologyPage;
