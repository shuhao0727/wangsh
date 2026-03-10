import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Breadcrumb, Spin, Grid, Alert, Button, Empty, Space, Tag, Skeleton } from 'antd';
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  CodeOutlined,
  HomeOutlined,
  RocketOutlined,
  ReloadOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import RollCallPlayer from './RollCallPlayer';
import ClassSelector from './ClassSelector';
import { DianmingClass } from '@/services/xxjs/dianming';
import { featureFlagsApi } from '@/services/system/featureFlags';
import './ITTechnology.css';

const { Text, Title, Paragraph } = Typography;

type ViewState =
  | 'launcher'
  | 'rollcall-selector'
  | 'rollcall-player';

const ITTechnologyPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isCompactViewport = !screens.sm;
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('launcher');
  const [currentClass, setCurrentClass] = useState<DianmingClass | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = ['it_dianming_enabled', 'it_survey_enabled', 'it_mindmap_enabled', 'it_python_lab_enabled'];
      const results = await Promise.all(
        keys.map(key => featureFlagsApi.getPublic(key).catch(() => ({ value: { enabled: false } } as any)))
      );
      
      const newFlags: Record<string, boolean> = {};
      results.forEach((res, index) => {
        const k = keys[index];
        const enabled = res.value?.enabled === true;
        if (!enabled && k === 'it_python_lab_enabled' && process.env.REACT_APP_ENV === 'development') {
          newFlags[k] = res.value?.enabled !== false;
          return;
        }
        newFlags[k] = enabled;
      });
      setFlags(newFlags);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '加载配置失败，请检查网络或刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleSelectClass = (record: DianmingClass) => {
    setCurrentClass(record);
    setView('rollcall-player');
  };

  const renderBreadcrumb = () => (
    <Breadcrumb style={{ marginBottom: "var(--ws-space-3)" }}
      items={[
        {
          title: <><HomeOutlined /> 首页</>,
          href: "#",
          onClick: (e) => { e.preventDefault(); setView('launcher'); setCurrentClass(null); }
        },
        ...(view !== 'launcher' ? [{
          title: '随机点名',
          href: "#",
          onClick: (e: React.MouseEvent) => { e.preventDefault(); setView('rollcall-selector'); setCurrentClass(null); }
        }] : []),
        ...(view === 'rollcall-player' && currentClass ? [{
          title: currentClass.class_name
        }] : [])
      ]}
    />
  );

  // 1. 点名播放器视图 (全屏覆盖)
  if (view === 'rollcall-player' && currentClass) {
    return (
      <RollCallPlayer 
        record={currentClass} 
        onBack={() => { setView('rollcall-selector'); setCurrentClass(null); }} 
      />
    );
  }

  if (loading) {
    return (
      <div className="it-technology-page">
        <Card className="it-card">
          <div className="it-technology-loading">
            <Skeleton active />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="it-technology-page">
         <Alert
          type="error"
          message="加载失败"
          description={error}
          showIcon
          action={
            <Button size="small" type="primary" onClick={loadFlags} icon={<ReloadOutlined />}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="it-technology-page">
      {view === 'launcher' ? (
        <>
          <Row gutter={[16, 16]}>
            {/* 随机点名卡片 */}
            {flags['it_dianming_enabled'] && (
              <Col xs={24} md={12} lg={8}>
                <Card
                  className="it-card"
                  styles={{ body: { padding: "var(--ws-space-3)" } }}
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Space align="center" style={{ justifyContent: "space-between", width: '100%' }}>
                      <Text strong style={{ fontSize: "var(--ws-text-md)" }}>
                        随机点名
                      </Text>
                      <Tag color="blue">工具</Tag>
                    </Space>
                    <Text type="secondary">
                      公平公正的随机抽取工具，支持班级名单导入与特效展示。
                    </Text>
                    <div>
                      <Button 
                        type="primary" 
                        icon={<ArrowRightOutlined />}
                        onClick={() => setView('rollcall-selector')}
                      >
                        进入
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            )}

            {(flags['it_python_lab_enabled'] || process.env.REACT_APP_ENV === 'development') && (
              <Col xs={24} md={12} lg={8}>
                <Card
                  className="it-card"
                  styles={{ body: { padding: "var(--ws-space-3)" } }}
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Space align="center" style={{ justifyContent: "space-between", width: '100%' }}>
                      <Text strong style={{ fontSize: "var(--ws-text-md)" }}>
                        Python 实验室
                      </Text>
                      <Tag color="purple">编程</Tag>
                    </Space>
                    <Text type="secondary">
                      可视化流程图编程与代码实时转换，支持断点调试与变量追踪。
                    </Text>
                    <div>
                      <Button 
                        type="primary" 
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate('/it-technology/python-lab')}
                      >
                        进入
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            )}

            {/* 问卷调查卡片 */}
            {flags['it_survey_enabled'] && (
              <Col xs={24} md={12} lg={8}>
                <Card
                  className="it-card"
                  styles={{ body: { padding: "var(--ws-space-3)" } }}
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Space align="center" style={{ justifyContent: "space-between", width: '100%' }}>
                      <Text strong style={{ fontSize: "var(--ws-text-md)" }}>
                        问卷调查
                      </Text>
                      <Tag color="cyan">数据</Tag>
                    </Space>
                    <Text type="secondary">
                      快速创建在线问卷，收集反馈并实时分析数据。(开发中)
                    </Text>
                    <div>
                      <Button disabled icon={<ArrowRightOutlined />}>
                        敬请期待
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            )}

            {/* 思维导图卡片 */}
            {flags['it_mindmap_enabled'] && (
              <Col xs={24} md={12} lg={8}>
                <Card
                  className="it-card"
                  styles={{ body: { padding: "var(--ws-space-3)" } }}
                >
                  <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                    <Space align="center" style={{ justifyContent: "space-between", width: '100%' }}>
                      <Text strong style={{ fontSize: "var(--ws-text-md)" }}>
                        思维导图
                      </Text>
                      <Tag color="gold">工具</Tag>
                    </Space>
                    <Text type="secondary">
                      结构化您的创意，在线绘制流程图与知识图谱。(开发中)
                    </Text>
                    <div>
                      <Button disabled icon={<ArrowRightOutlined />}>
                        敬请期待
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            )}
            
            {/* 如果没有任何应用开启 */}
            {!loading && !flags['it_dianming_enabled'] && !flags['it_python_lab_enabled'] && !flags['it_survey_enabled'] && !flags['it_mindmap_enabled'] && (
              <Col span={24} style={{ textAlign: 'center', padding: 50 }}>
                <Empty description="暂无可用应用，请联系管理员在后台开启。" />
              </Col>
            )}
          </Row>
        </>
      ) : (
        // 2. 班级选择视图
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {renderBreadcrumb()}
          <div style={{ background: 'var(--ws-color-surface)', padding: 'var(--ws-space-4)', borderRadius: 'var(--ws-radius-lg)', flex: 1 }}>
            <ClassSelector onSelect={handleSelectClass} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ITTechnologyPage;
