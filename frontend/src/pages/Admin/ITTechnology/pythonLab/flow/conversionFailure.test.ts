import { classifyConversionFailure } from "./conversionFailure";

test("分类为结构丢失并触发 AI 兜底", () => {
  const res = classifyConversionFailure({
    code: "while i 的值在列表:",
    strictOk: false,
    strictErrors: ["invalid syntax"],
    warnings: [],
  });
  expect(res.category).toBe("structure_loss");
  expect(res.shouldTriggerAiFallback).toBe(true);
  expect(res.signatures.includes("iter_leak_or_nonpython_loop")).toBe(true);
});

test("网络超时不触发 AI 二次兜底", () => {
  const res = classifyConversionFailure({
    code: "print(1)",
    strictOk: true,
    warnings: [],
    upstreamError: { message: "timeout of 8000ms exceeded", code: "ECONNABORTED" },
  });
  expect(res.category).toBe("network_timeout");
  expect(res.shouldTriggerAiFallback).toBe(false);
});

test("噪音日志归类为 noise_log", () => {
  const res = classifyConversionFailure({
    code: "print(1)",
    strictOk: true,
    warnings: ["IndexSizeError in content-script"],
  });
  expect(res.category).toBe("noise_log");
  expect(res.shouldTriggerAiFallback).toBe(false);
});

test("XHR 无响应归类为 network_timeout", () => {
  const res = classifyConversionFailure({
    code: "print(1)",
    strictOk: true,
    warnings: [],
    upstreamError: { request: {}, response: null, message: "Network Error" },
  });
  expect(res.category).toBe("network_timeout");
  expect(res.shouldTriggerAiFallback).toBe(false);
});

test("Monaco worker 噪音归类为 noise_log", () => {
  const res = classifyConversionFailure({
    code: "print(1)",
    strictOk: true,
    warnings: ["Monaco worker source map load failed"],
  });
  expect(res.category).toBe("noise_log");
  expect(res.shouldTriggerAiFallback).toBe(false);
});
