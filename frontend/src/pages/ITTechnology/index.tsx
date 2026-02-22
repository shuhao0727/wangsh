import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Divider, Button, Breadcrumb, Spin } from 'antd';
import { 
  ExperimentOutlined, 
  FormOutlined, 
  NodeIndexOutlined, 
  CodeOutlined,
  LaptopOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import RollCallPlayer from './RollCallPlayer';
import ClassSelector from './ClassSelector';
import { DianmingClass } from '@/services/xxjs/dianming';
import { featureFlagsApi } from '@/services/system/featureFlags';

const { Title, Text } = Typography;

type ViewState =
  | 'launcher'
  | 'rollcall-selector'
  | 'rollcall-player';

const ITTechnologyPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('launcher');
  const [currentClass, setCurrentClass] = useState<DianmingClass | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlags = async () => {
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
    <div style={{ padding: "32px", maxWidth: "1600px", margin: "0 auto" }}>
      <Row gutter={[16, 16]}>
        {/* 随机点名卡片 */}
        {flags['it_dianming_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)", height: '100%' }}
              styles={{ body: { padding: 18 } }}
              onClick={() => setView('rollcall-selector')}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #36cfc9 0%, #1890ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  marginRight: 12
                }}>
                  <ExperimentOutlined />
                </div>
                <Text strong style={{ fontSize: 16 }}>随机点名</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                公平公正的随机抽取工具，支持班级名单导入与特效展示。
              </Text>
            </Card>
          </Col>
        )}

        {(flags['it_python_lab_enabled'] || process.env.REACT_APP_ENV === 'development') && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)", height: '100%' }}
              styles={{ body: { padding: 18 } }}
              onClick={() => {
                navigate('/it-technology/python-lab');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #9254de 0%, #36cfc9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  marginRight: 12
                }}>
                  <CodeOutlined />
                </div>
                <Text strong style={{ fontSize: 16 }}>Python 实验室</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                左侧模块，中间画布，右侧代码与变量调试。
              </Text>
            </Card>
          </Col>
        )}

        {/* 问卷调查卡片 */}
        {flags['it_survey_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)", height: '100%', opacity: 0.7 }}
              styles={{ body: { padding: 18 } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #b37feb 0%, #722ed1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  marginRight: 12
                }}>
                  <FormOutlined />
                </div>
                <Text strong style={{ fontSize: 16 }}>问卷调查</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                快速创建在线问卷，收集反馈并实时分析数据。(开发中)
              </Text>
            </Card>
          </Col>
        )}

        {/* 思维导图卡片 */}
        {flags['it_mindmap_enabled'] && (
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ borderRadius: 12, border: "1px solid var(--ws-color-border)", height: '100%', opacity: 0.7 }}
              styles={{ body: { padding: 18 } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #ffd666 0%, #fa8c16 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  marginRight: 12
                }}>
                  <NodeIndexOutlined />
                </div>
                <Text strong style={{ fontSize: 16 }}>思维导图</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                结构化您的创意，在线绘制流程图与知识图谱。(开发中)
              </Text>
            </Card>
          </Col>
        )}
        
        {/* 如果没有任何应用开启 */}
        {!loading && !flags['it_dianming_enabled'] && !flags['it_python_lab_enabled'] && !flags['it_survey_enabled'] && !flags['it_mindmap_enabled'] && (
          <Col span={24} style={{ textAlign: 'center', padding: 50 }}>
            <Text type="secondary">暂无可用应用，请联系管理员在后台开启。</Text>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ITTechnologyPage;
