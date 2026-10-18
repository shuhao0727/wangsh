import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-[calc(100dvh-var(--ws-header-height))] items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-4 border-b border-border-secondary pb-5">
          <span className="text-4xl font-semibold tabular-nums text-text-tertiary">404</span>
          <div className="min-w-0 border-l border-border-secondary pl-4">
            <h1 className="text-base font-semibold text-text-base">页面不存在</h1>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={() => navigate('/home')}>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回上一页
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
