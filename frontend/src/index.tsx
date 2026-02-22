import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import './styles/index.css';
import './styles/ui-polish.css';
import "./utils/dayjs";
import App from './App';
import { AuthProvider } from '@hooks/useAuth';

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
            colorPrimary: "#3498db",
            colorInfo: "#3498db",
            colorSuccess: "#2ecc71",
            colorWarning: "#f1c40f",
            colorError: "#e74c3c",
            colorLink: "#3498db",
            colorLinkHover: "#5dade2",
            colorLinkActive: "#2980b9",
            colorText: "#2c3e50", // Softened from #1f1f1f
            colorTextSecondary: "#7f8c8d",
            colorTextTertiary: "#95a5a6",
            colorTextQuaternary: "#bdc3c7",
            colorBorder: "transparent", 
            colorBorderSecondary: "#f0f0f0", 
            colorBgLayout: "#ffffff",
            colorBgSpotlight: "#ffffff",
            colorBgContainer: "#ffffff",
            colorBgElevated: "#ffffff",
            lineWidth: 1,
            controlHeight: 36, // Standardize control height to 36px (more comfortable)
            controlHeightLG: 40,
            controlHeightSM: 28,
            fontSize: 14,
            borderRadius: 6, // Adjusted to 6px
            borderRadiusLG: 8,
            borderRadiusSM: 4,
          },
          components: {
            Button: {
              fontWeight: 500,
              controlHeight: 36, // Match global control height
              paddingContentHorizontal: 16, 
              borderRadius: 6, 
            },
            Card: {
              headerBg: "#ffffff",
              colorBgContainer: "#ffffff",
              paddingLG: 32, // Increase padding for "loosened" layout
              paddingSM: 20,
              boxShadow: "none",
              colorBorderSecondary: "transparent",
              borderRadius: 8, 
            },
            Layout: {
              bodyBg: "#ffffff",
              headerBg: "#ffffff",
              headerPadding: "0 32px", // Looser header padding
            },
            Menu: {
              itemSelectedBg: "#f0f7ff", // Soft blue bg
              itemSelectedColor: "#3498db", // Blue text
              itemBorderRadius: 6,
              itemMarginInline: 8,
            },
            Modal: {
              paddingContentHorizontalLG: 24,
              paddingContentVerticalLG: 24,
              boxShadow: "0 6px 16px rgba(0,0,0,0.08)", // Softer shadow
              borderRadiusLG: 8,
            },
            Table: {
              headerBg: "#ffffff",
              headerColor: "#7f8c8d",
              headerSplitColor: "transparent",
              borderColor: "transparent", 
              cellPaddingInline: 24, // Looser table spacing
              cellPaddingBlock: 16,
              rowSelectedBg: "#f0f7ff",
              rowSelectedHoverBg: "#e6f7ff",
              rowHoverBg: "#fafafa", 
            },
            Tooltip: {
              colorBgSpotlight: "rgba(0, 0, 0, 0.85)",
              colorTextLightSolid: "#ffffff",
              borderRadius: 4,
            },
            Tabs: {
              itemSelectedColor: "#3498db",
              itemHoverColor: "#5dade2",
              inkBarColor: "#3498db",
            },
            Input: {
              controlHeight: 36, // Match global control height
              borderRadius: 6, 
            },
            Select: {
              controlHeight: 36,
              borderRadius: 6,
            },
          },
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
