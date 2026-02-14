import React, { useState, useEffect } from 'react';
import { Card, Spin, Empty, Typography } from 'antd';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';

const { Meta } = Card;
const { Text } = Typography;

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
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;

  if (classes.length === 0) return <Empty description="暂无班级数据，请联系管理员添加" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {classes.map((cls) => (
        <Card
          key={`${cls.year}-${cls.class_name}`}
          hoverable
          onClick={() => onSelect(cls)}
          style={{ textAlign: 'center', borderColor: '#d9d9d9' }}
        >
          <Meta
            title={<span style={{ fontSize: 18 }}>{cls.class_name}</span>}
            description={
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">{cls.year}</Text>
                <br />
                <Text type="secondary">{cls.count} 人</Text>
              </div>
            }
          />
        </Card>
      ))}
    </div>
  );
};

export default ClassSelector;
