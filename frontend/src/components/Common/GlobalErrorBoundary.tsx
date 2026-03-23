import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button, Result, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

const { Paragraph, Text } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-5 bg-surface">
          <Result
            status="error"
            title="页面遇到了一些问题"
            subTitle="抱歉，应用程序发生了一个意外错误。我们已经记录了这个问题。"
            extra={[
              <Button type="primary" key="reload" icon={<ReloadOutlined />} onClick={this.handleReload}>
                刷新页面
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="desc">
                <Paragraph>
                  <Text strong className="text-base">错误详情:</Text>
                </Paragraph>
                <Paragraph>
                  <Text type="danger">{this.state.error.toString()}</Text>
                </Paragraph>
                {this.state.errorInfo && (
                  <Paragraph>
                    <pre className="max-w-2xl overflow-auto p-4 rounded text-xs bg-black/5">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Paragraph>
                )}
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
