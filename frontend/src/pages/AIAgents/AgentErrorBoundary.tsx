import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AgentErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertTriangle className="h-12 w-12 text-error" />
          <div className="text-xl font-bold text-text-base">页面出现异常</div>
          <div className="text-sm text-text-secondary">{this.state.error?.message || "未知错误"}</div>
          <Button onClick={this.handleReset}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AgentErrorBoundary;
