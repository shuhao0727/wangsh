import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

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
          <div className="text-center max-w-lg">
            <AlertTriangle className="h-16 w-16 text-error mx-auto mb-4" />
            <div className="text-2xl font-bold text-text-base mb-2">页面遇到了一些问题</div>
            <div className="text-base text-text-secondary mb-6">抱歉，应用程序发生了一个意外错误。我们已经记录了这个问题。</div>
            <Button onClick={this.handleReload}>
              <RefreshCw className="h-4 w-4" />
              刷新页面
            </Button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-6 text-left">
                <p><span className="text-base font-semibold">错误详情:</span></p>
                <p><span className="text-error">{this.state.error.toString()}</span></p>
                {this.state.errorInfo && (
                  <pre className="max-w-2xl overflow-auto p-4 rounded text-xs bg-black/5 mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
