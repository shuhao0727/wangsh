import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Layout, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import useAuth from "@hooks/useAuth";

const { Header, Content } = Layout;
const { Text } = Typography;

const AdminEditorLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useAuth();

  const isArticleEditor = location.pathname.startsWith("/admin/articles/editor");
  const isTypstEditor = location.pathname.startsWith("/admin/informatics/editor");

  const backToList = () => {
    if (isTypstEditor) navigate("/admin/informatics");
    else navigate("/admin/articles");
  };

  const title = (() => {
    if (isTypstEditor) return location.pathname.includes("/new") ? "新建 Typst 笔记" : "编辑 Typst 笔记";
    if (isArticleEditor) return location.pathname.includes("/new") ? "新建文章" : "编辑文章";
    return "编辑";
  })();

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--ws-color-bg)" }}>
      <Header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          height: 56,
          padding: "0 16px",
          background: "var(--ws-color-surface)",
          borderBottom: "1px solid var(--ws-color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Space size={10}>
          <Button icon={<ArrowLeftOutlined />} onClick={backToList}>
            返回列表
          </Button>
          <Text strong style={{ fontSize: 16 }}>
            {title}
          </Text>
        </Space>
        <Space>
          <Button onClick={() => window.close()}>关闭窗口</Button>
        </Space>
      </Header>
      <Content style={{ padding: isTypstEditor || isArticleEditor ? 0 : 16 }}>
        <div style={{ maxWidth: isTypstEditor || isArticleEditor ? "none" : 1600, margin: isTypstEditor || isArticleEditor ? 0 : "0 auto" }}>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
};

export default AdminEditorLayout;
