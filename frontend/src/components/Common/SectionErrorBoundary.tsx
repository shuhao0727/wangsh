import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** 用于日志区分不同 section */
  sectionName?: string;
  /** 自定义错误渲染（可选） */
  fallback?: (error: Error | null, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Section 级错误边界 — 包裹页面中某块独立数据/组件，
 * 单处渲染失败不会整页崩溃，用户可重试该 section。
 *
 * 与 PageErrorBoundary 区别：UI 更紧凑、inline 风格，
 * 可多处嵌套使用。
 */
class SectionErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[SectionErrorBoundary${this.props.sectionName ? `:${this.props.sectionName}` : ""}]`,
      error,
      errorInfo,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.handleRetry);
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-border-secondary bg-surface-2 px-4 py-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-[var(--ws-color-warning)]" />
        <div className="text-sm font-medium text-text-base">此区域加载失败</div>
        <div className="text-xs text-text-tertiary">
          数据渲染出现异常，可尝试重试该区域
        </div>
        <Button
          onClick={this.handleRetry}
          size="sm"
          variant="outline"
          className="mt-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </Button>
        {process.env.NODE_ENV === "development" && this.state.error && (
          <pre className="mt-2 max-w-full overflow-auto rounded bg-black/5 p-2 text-left text-xs text-error">
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    );
  }
}

export default SectionErrorBoundary;
