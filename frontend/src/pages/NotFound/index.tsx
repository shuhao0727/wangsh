import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-[calc(100vh-var(--ws-header-height)-80px)] items-center justify-center bg-bg p-6 sm:min-h-[calc(100vh-var(--ws-header-height)-40px)] sm:p-4">
      <div className="text-center">
        <div className="text-7xl font-bold text-text-tertiary mb-2">404</div>
        <div className="text-base text-text-secondary mb-6">抱歉，您访问的页面不存在。</div>
        <Button onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
