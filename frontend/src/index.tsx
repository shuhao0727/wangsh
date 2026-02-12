import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import './styles/index.css';
import './styles/ui-polish.css';
import "./utils/dayjs";
import App from './App';

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
      <ConfigProvider
        theme={{
          cssVar: { key: "ws" },
          token: {
            colorPrimary: "#1677ff",
            colorInfo: "#1677ff",
            colorSuccess: "#52c41a",
            colorWarning: "#faad14",
            colorError: "#ff4d4f",
            colorLink: "#1677ff",
            colorLinkHover: "#4096ff",
            colorLinkActive: "#0958d9",
            colorText: "#1f1f1f",
            colorTextSecondary: "#595959",
            colorTextTertiary: "#8c8c8c",
            colorTextQuaternary: "#bfbfbf",
            colorBorder: "#d9d9d9",
            colorBorderSecondary: "#f0f0f0",
            colorBgLayout: "#f5f5f5",
            colorBgSpotlight: "#ffffff",
            colorBgContainer: "#ffffff",
            colorBgElevated: "#ffffff",
            lineWidth: 1,
            controlHeight: 36,
            controlHeightLG: 40,
            controlHeightSM: 28,
            fontSize: 14,
            borderRadius: 10,
            borderRadiusLG: 12,
            borderRadiusSM: 8,
          },
          components: {
            Button: {
              fontWeight: 500,
            },
            Card: {
              headerBg: "#fafafa",
              paddingLG: 16,
              paddingSM: 12,
            },
            Modal: {
              paddingContentHorizontalLG: 20,
              paddingContentVerticalLG: 20,
            },
            Table: {
              headerBg: "#fafafa",
              headerColor: "#1f1f1f",
              headerSplitColor: "#f0f0f0",
              borderColor: "#f0f0f0",
              cellPaddingInline: 12,
              cellPaddingBlock: 10,
              rowSelectedBg: "#e6f4ff",
              rowSelectedHoverBg: "#bae0ff",
              rowHoverBg: "#f5f5f5",
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
