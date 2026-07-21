export async function isNotFoundPage(page) {
  const [codeCount, messageCount] = await Promise.all([
    page.getByText("404", { exact: true }).count(),
    page.getByText("抱歉，您访问的页面不存在。", { exact: true }).count(),
  ]);

  return codeCount > 0 && messageCount > 0;
}

export function classifySmokeAction(action) {
  if (typeof action === "string" && action.startsWith("skip-")) {
    return {
      status: "WARN",
      note: `action skipped: ${action}`,
    };
  }

  return {
    status: null,
    note: "",
  };
}

export function summarizeSmokeStatuses({ pass = 0, warn = 0, fail = 0 }) {
  if (fail > 0) {
    return {
      level: "FAIL",
      message: `UI smoke: ${pass} passed, ${warn} warned, ${fail} failed`,
    };
  }
  if (warn > 0) {
    return {
      level: "WARN",
      message: `UI smoke: ${pass} passed, ${warn} warned, 0 failed`,
    };
  }
  return {
    level: "OK",
    message: `UI smoke: ${pass} passed, 0 warned, 0 failed`,
  };
}
