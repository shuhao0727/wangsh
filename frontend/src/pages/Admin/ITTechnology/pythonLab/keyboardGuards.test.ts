import { shouldHandleCanvasDeleteShortcut, shouldStopMonacoEditorKeyPropagation } from "./keyboardGuards";

test("画布选中时 Delete 触发全局删除", () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Delete",
      target: div,
      activeElement: document.body,
      hasSelection: true,
    })
  ).toBe(true);
  div.remove();
});

test("Monaco 输入区聚焦时 Backspace 不触发全局删除", () => {
  const monacoRoot = document.createElement("div");
  monacoRoot.className = "monaco-editor";
  const inputarea = document.createElement("textarea");
  inputarea.className = "inputarea";
  monacoRoot.appendChild(inputarea);
  document.body.appendChild(monacoRoot);
  inputarea.focus();
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Backspace",
      target: inputarea,
      activeElement: document.activeElement,
      hasSelection: true,
    })
  ).toBe(false);
  monacoRoot.remove();
});

test("普通输入框聚焦时 Delete 不触发全局删除", () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Delete",
      target: input,
      activeElement: document.activeElement,
      hasSelection: true,
    })
  ).toBe(false);
  input.remove();
});

test("组合输入期间不触发全局删除", () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Delete",
      isComposing: true,
      target: div,
      activeElement: document.body,
      hasSelection: true,
    })
  ).toBe(false);
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Delete",
      keyCode: 229,
      target: div,
      activeElement: document.body,
      hasSelection: true,
    })
  ).toBe(false);
  div.remove();
});

test("已被编辑器处理的删除键不触发全局删除", () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  expect(
    shouldHandleCanvasDeleteShortcut({
      key: "Backspace",
      defaultPrevented: true,
      target: div,
      activeElement: document.body,
      hasSelection: true,
    })
  ).toBe(false);
  div.remove();
});

test("Monaco 内 Enter/Delete 需阻止冒泡，Backspace 不拦截", () => {
  expect(shouldStopMonacoEditorKeyPropagation({ key: "Enter" })).toBe(true);
  expect(shouldStopMonacoEditorKeyPropagation({ key: "Delete" })).toBe(true);
  expect(shouldStopMonacoEditorKeyPropagation({ key: "Backspace" })).toBe(false);
  expect(shouldStopMonacoEditorKeyPropagation({ key: "a" })).toBe(false);
});

test("组合输入期间 Enter 不阻止冒泡", () => {
  expect(shouldStopMonacoEditorKeyPropagation({ key: "Enter", isComposing: true })).toBe(false);
  expect(shouldStopMonacoEditorKeyPropagation({ key: "Enter", keyCode: 229 })).toBe(false);
});
