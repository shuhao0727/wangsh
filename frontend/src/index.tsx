import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import './styles/index.css';
import './styles/ui-polish.css';
import "./styles/responsive-audit.css";
import "./utils/dayjs";
import App from './App';
import { AuthProvider } from '@hooks/useAuth';
import { antdTheme } from './styles/antdTheme';

// 获取根元素
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

// 创建根并渲染应用
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={antdTheme} locale={zhCN}>
        <AntdApp>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
