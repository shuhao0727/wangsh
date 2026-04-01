import React, { useState, useEffect } from 'react';
import { Typography, Skeleton } from 'antd';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';
import { logger } from '@/services/logger';
import { TeamOutlined } from '@ant-design/icons';
import EmptyState from "@components/Common/EmptyState";

const { Text } = Typography;

interface Props {
  onSelect: (record: DianmingClass) => void;
}

const ClassSelector: React.FC<Props> = ({ onSelect }) => {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<DianmingClass[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await dianmingApi.listClasses();
        setClasses(res);
      } catch (error) {
        logger.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl p-6 bg-surface-2 h-40 flex flex-col justify-center">
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        ))}
      </div>
    );
  }

  if (classes.length === 0) {
    return <EmptyState description="暂无班级数据，请联系管理员添加" />;
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {classes.map((cls) => (
        <div
          key={`${cls.year}-${cls.class_name}`}
          onClick={() => onSelect(cls)}
          className="it-class-card rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer bg-surface-2 transition-all duration-150"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full text-3xl text-primary"
            style={{ background: 'rgba(14,165,233,0.1)' }}>
            <TeamOutlined />
          </div>
          <div className="text-center">
            <div className="font-semibold text-base text-text-base">{cls.class_name}</div>
            <Text type="secondary" className="text-sm">{cls.year}级</Text>
          </div>
          <div className="px-3 py-1 rounded-full text-xs text-text-secondary bg-surface-2"
            style={{ background: 'rgba(0,0,0,0.04)' }}>
            共 {cls.count} 人
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassSelector;
