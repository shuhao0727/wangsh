import fs from "fs";
import path from "path";

const readPanelSource = () => {
  const filePath = path.join(__dirname, "AssessmentPanel.tsx");
  return fs.readFileSync(filePath, "utf8");
};

// ─── AssessmentPanel 组件结构测试 ───

test("AssessmentPanel accepts required props interface", () => {
  const src = readPanelSource();
  expect(src).toContain("isAuthenticated: boolean");
  expect(src).toContain("isStudent: boolean");
  expect(src).toContain("isAdmin: boolean");
  expect(src).toContain("userId?: number");
});

test("AssessmentPanel imports assessmentSessionApi", () => {
  const src = readPanelSource();
  expect(src).toContain("assessmentSessionApi");
});

test("AssessmentPanel uses createPortal for floating window", () => {
  const src = readPanelSource();
  expect(src).toContain("createPortal");
  expect(src).toContain("document.body");
});

test("AssessmentPanel has list/quiz/result views and basic/advanced result tabs", () => {
  const src = readPanelSource();
  // 主视图
  expect(src).toContain('"list"');
  expect(src).toContain('"quiz"');
  expect(src).toContain('"result"');
  // 结果页 Tab
  expect(src).toContain('"basic"');
  expect(src).toContain('"advanced"');
});

test("AssessmentPanel persists window state in localStorage", () => {
  const src = readPanelSource();
  expect(src).toContain("localStorage");
  expect(src).toContain("assessment_floating_pinned");
});

test("AssessmentPanel implements panel mutual exclusion via CustomEvent", () => {
  const src = readPanelSource();
  expect(src).toContain("panel-open");
  expect(src).toContain("CustomEvent");
  expect(src).toContain("dispatchEvent");
});

test("AssessmentPanel handles countdown timer", () => {
  const src = readPanelSource();
  expect(src).toContain("countdown");
  expect(src).toContain("setInterval");
});

test("AssessmentPanel supports choice, fill, and short_answer question types", () => {
  const src = readPanelSource();
  expect(src).toContain("choice");
  expect(src).toContain("fill");
  expect(src).toContain("short_answer");
});

test("AssessmentPanel has submit all functionality", () => {
  const src = readPanelSource();
  expect(src).toContain("submit");
  expect(src).toContain("提交检测");
});

test("AssessmentPanel renders floating button at left side", () => {
  const src = readPanelSource();
  expect(src).toContain("position: \"fixed\"");
  expect(src).toContain("left:");
});

test("AssessmentPanel supports drag interaction", () => {
  const src = readPanelSource();
  expect(src).toContain("onPointerDown");
  expect(src).toContain("onPointerMove");
  expect(src).toContain("onPointerUp");
});
