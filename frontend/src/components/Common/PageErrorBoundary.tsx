import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class PageErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PageErrorBoundary${this.props.pageName ? `:${this.props.pageName}` : ""}]`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-10">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-10 w-10 text-[var(--ws-color-warning)] mx-auto mb-3" />
            <div className="text-lg font-semibold text-text mb-1">页面加载异常</div>
            <div className="text-sm text-text-secondary mb-4">
              该页面渲染时发生错误，请重试。如问题持续出现，请联系管理员。
            </div>
            <Button onClick={this.handleRetry} size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              重试
            </Button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="mt-4 max-w-full overflow-auto rounded bg-black/5 p-3 text-left text-xs text-error">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
