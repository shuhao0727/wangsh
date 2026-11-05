// 判定文案须与 frontend/src/pages/NotFound/index.tsx 保持一致；
// 防漂移合同测试见 prod-smoke-ui-lib.test.mjs。
export const NOT_FOUND_MARKERS = ["404", "页面不存在"];

export async function isNotFoundPage(page) {
  const counts = await Promise.all(
    NOT_FOUND_MARKERS.map((marker) =>
      page.getByText(marker, { exact: true }).count(),
    ),
  );

  return counts.every((count) => count > 0);
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
