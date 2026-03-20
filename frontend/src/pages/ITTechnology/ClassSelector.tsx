import React, { useState, useEffect } from 'react';
import { Spin, Empty, Typography, Skeleton } from 'antd';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';
import { logger } from '@/services/logger';
import { TeamOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface Props {
  onSelect: (record: DianmingClass) => void;
}

const ClassSelector: React.FC<Props> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<DianmingClass[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await dianmingApi.listClasses();
        setClasses(res);
      } catch (error) {
        logger.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="it-class-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="it-class-card" style={{ padding: 24, height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        ))}
      </div>
    );
  }

  if (classes.length === 0) return <Empty description="暂无班级数据，请联系管理员添加" />;

  return (
    <div className="it-class-grid">
      {classes.map((cls) => (
        <div
          key={`${cls.year}-${cls.class_name}`}
          className="it-class-card"
          onClick={() => onSelect(cls)}
          style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
        >
          <div 
            style={{ 
              width: 56, 
              height: 56, 
              borderRadius: '50%', 
              background: 'var(--ws-color-primary-bg)', 
              color: 'var(--ws-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              marginBottom: 8
            }}
          >
            <TeamOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--ws-color-text)' }}>{cls.class_name}</Title>
            <Text type="secondary" style={{ fontSize: 14 }}>{cls.year}级</Text>
          </div>
          <div 
            style={{ 
              background: 'var(--ws-color-bg-layout)', 
              padding: '4px 12px', 
              borderRadius: 12, 
              fontSize: 12,
              color: 'var(--ws-color-text-secondary)'
            }}
          >
            共 {cls.count} 人
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassSelector;
