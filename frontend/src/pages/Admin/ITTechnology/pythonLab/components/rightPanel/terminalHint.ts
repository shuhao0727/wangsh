export function getTerminalModeHint(params: {
    sessionId: string | null;
    status: "idle" | "starting" | "running" | "paused" | "stopped" | "error";
    lastLaunchMode?: "idle" | "run" | "debug";
}) {
    const { sessionId, status, lastLaunchMode } = params;
    if (sessionId) return null;
    if (status === "starting") {
        return lastLaunchMode === "debug" ? "正在创建调试会话并连接终端..." : "正在创建会话并连接终端...";
    }
    if (status === "running" || status === "paused" || status === "stopped") return "正在连接终端...";
    if (lastLaunchMode === "debug") return "点击调试后会自动连接终端";
    return "点击运行后会自动连接终端";
}
