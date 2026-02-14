import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Divider, Button, Breadcrumb, Spin } from 'antd';
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  LaptopOutlined,
  HomeOutlined
} from '@ant-design/icons';
import RollCallPlayer from './RollCallPlayer';
import ClassSelector from './ClassSelector';
import { DianmingClass } from '@/services/xxjs/dianming';
import { featureFlagsApi } from '@/services/system/featureFlags';

const { Title, Text } = Typography;

type ViewState = 'launcher' | 'rollcall-selector' | 'rollcall-player';

const ITTechnologyPage: React.FC = () => {
  const [view, setView] = useState<ViewState>('launcher');
  const [currentClass, setCurrentClass] = useState<DianmingClass | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const keys = ['it_dianming_enabled', 'it_survey_enabled', 'it_mindmap_enabled'];
        const results = await Promise.all(
          keys.map(key => featureFlagsApi.getPublic(key).catch(() => ({ value: { enabled: false } } as any)))
        );
        
        const newFlags: Record<string, boolean> = {};
        results.forEach((res, index) => {
          newFlags[keys[index]] = res.value?.enabled === true;
        });
        setFlags(newFlags);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadFlags();
  }, []);

  const handleSelectClass = (record: DianmingClass) => {
    setCurrentClass(record);
    setView('rollcall-player');
  };

  const renderBreadcrumb = () => (
    <Breadcrumb style={{ marginBottom: 16 }}>
      <Breadcrumb.Item href="#" onClick={() => { setView('launcher'); setCurrentClass(null); }}>
        <HomeOutlined /> 首页
      </Breadcrumb.Item>
      {view !== 'launcher' && (
        <Breadcrumb.Item href="#" onClick={() => { setView('rollcall-selector'); setCurrentClass(null); }}>
          随机点名
        </Breadcrumb.Item>
      )}
      {view === 'rollcall-player' && currentClass && (
        <Breadcrumb.Item>{currentClass.class_name}</Breadcrumb.Item>
      )}
    </Breadcrumb>
  );

  // 1. 点名播放器视图
  if (view === 'rollcall-player' && currentClass) {
    return (
      <RollCallPlayer 
        record={currentClass} 
        onBack={() => { setView('rollcall-selector'); setCurrentClass(null); }} 
      />
    );
  }

  // 2. 班级选择视图
  if (view === 'rollcall-selector') {
    return (
      <div style={{ padding: 24 }}>
        {renderBreadcrumb()}
        <Title level={2}>请选择班级</Title>
        <Divider />
        <ClassSelector onSelect={handleSelectClass} />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 3. 应用启动台视图 (Launcher)
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <Title level={1} style={{ marginBottom: 8 }}>
          <LaptopOutlined /> IT 技术实验室
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          探索信息技术的乐趣，体验智能化的课堂互动
        </Text>
      </div>

      <Row gutter={[32, 32]} justify="center">
        {/* 随机点名卡片 */}
        {flags['it_dianming_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
              onClick={() => setView('rollcall-selector')}
            >
              <div style={{ 
                height: 160, 
                background: 'linear-gradient(135deg, #36cfc9 0%, #1890ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 64
              }}>
                <ExperimentOutlined />
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Title level={4} style={{ marginBottom: 8 }}>随机点名</Title>
                <Text type="secondary" style={{ flex: 1 }}>
                  公平公正的随机抽取工具，支持班级名单导入与特效展示。
                </Text>
                <Button type="primary" shape="round" style={{ marginTop: 16, width: '100%' }}>
                  立即开始
                </Button>
              </div>
            </Card>
          </Col>
        )}

        {/* 问卷调查卡片 */}
        {flags['it_survey_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', opacity: 0.8 }}
              bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ 
                height: 160, 
                background: 'linear-gradient(135deg, #b37feb 0%, #722ed1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 64
              }}>
                <FormOutlined />
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Title level={4} style={{ marginBottom: 8 }}>问卷调查</Title>
                <Text type="secondary" style={{ flex: 1 }}>
                  快速创建在线问卷，收集反馈并实时分析数据。
                </Text>
                <Button disabled shape="round" style={{ marginTop: 16, width: '100%' }}>
                  开发中
                </Button>
              </div>
            </Card>
          </Col>
        )}

        {/* 思维导图卡片 */}
        {flags['it_mindmap_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', opacity: 0.8 }}
              bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ 
                height: 160, 
                background: 'linear-gradient(135deg, #ffd666 0%, #fa8c16 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 64
              }}>
                <NodeIndexOutlined />
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Title level={4} style={{ marginBottom: 8 }}>思维导图</Title>
                <Text type="secondary" style={{ flex: 1 }}>
                  结构化您的创意，在线绘制流程图与知识图谱。
                </Text>
                <Button disabled shape="round" style={{ marginTop: 16, width: '100%' }}>
                  开发中
                </Button>
              </div>
            </Card>
          </Col>
        )}
        
        {/* 如果没有任何应用开启 */}
        {!loading && !flags['it_dianming_enabled'] && !flags['it_survey_enabled'] && !flags['it_mindmap_enabled'] && (
          <Col span={24} style={{ textAlign: 'center', padding: 50 }}>
            <Text type="secondary">暂无可用应用，请联系管理员在后台开启。</Text>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ITTechnologyPage;
