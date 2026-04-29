import "./polyfills";
import "@/lib/monacoWorkers";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import './styles/ui-polish.css';
import "./styles/responsive-audit.css";
import "./utils/dayjs";
import App from './App';
import { AuthProvider } from '@hooks/useAuth';
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// 获取根元素
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

// 创建根并渲染应用
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider delayDuration={120}>
          <AuthProvider>
            <App />
            <Toaster position="top-right" richColors closeButton toastOptions={{ style: { zIndex: 200000 } }} />
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
