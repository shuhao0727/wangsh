import { getTerminalModeHint } from "./terminalHint";

test("调试启动中返回调试态提示文案", () => {
    expect(getTerminalModeHint({ sessionId: null, status: "starting", lastLaunchMode: "debug" })).toBe(
        "正在创建调试会话并连接终端..."
    );
});

test("调试空闲时不显示运行引导文案", () => {
    expect(getTerminalModeHint({ sessionId: null, status: "idle", lastLaunchMode: "debug" })).toBe("点击调试后会自动连接终端");
});

test("运行空闲时显示运行引导文案", () => {
    expect(getTerminalModeHint({ sessionId: null, status: "idle", lastLaunchMode: "run" })).toBe("点击运行后会自动连接终端");
});

test("已有会话时不显示引导文案", () => {
    expect(getTerminalModeHint({ sessionId: "sid", status: "running", lastLaunchMode: "debug" })).toBeNull();
});
