import { toErrorMessage } from "./errorMessage";

test("toErrorMessage prefers Error.message", () => {
  expect(toErrorMessage(new Error("boom"), "fallback")).toBe("boom");
});

test("toErrorMessage prefers userMessage", () => {
  expect(toErrorMessage({ userMessage: "用户可读" }, "fallback")).toBe("用户可读");
});

test("toErrorMessage extracts axios-like response.data.detail/message", () => {
  expect(toErrorMessage({ response: { data: { detail: "detail_1" } } }, "fallback")).toBe("detail_1");
  expect(toErrorMessage({ response: { data: { message: "msg_1" } } }, "fallback")).toBe("msg_1");
});

test("toErrorMessage falls back when nothing useful is found", () => {
  expect(toErrorMessage({ foo: 1 }, " fallback ")).toBe("fallback");
  expect(toErrorMessage(null, "")).toBe("未知错误");
});
