import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';
import { logger } from '@/services/logger';
import { Users } from 'lucide-react';
import EmptyState from "@components/Common/EmptyState";

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
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-3xl text-primary">
            <Users className="h-8 w-8" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-base text-text-base">{cls.class_name}</div>
            <span className="text-sm text-text-secondary">{cls.year}级</span>
          </div>
          <div className="rounded-full bg-[var(--ws-color-hover-bg)] px-3 py-1 text-xs text-text-secondary">
            共 {cls.count} 人
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassSelector;
