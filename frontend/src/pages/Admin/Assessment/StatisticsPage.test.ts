import fs from "fs";
import path from "path";

const readSource = () => {
  const filePath = path.join(__dirname, "StatisticsPage.tsx");
  return fs.readFileSync(filePath, "utf8");
};

test("StatisticsPage imports required API services", () => {
  const src = readSource();
  expect(src).toContain("assessmentSessionApi");
  expect(src).toContain("assessmentConfigApi");
});

test("StatisticsPage uses useParams to get config id", () => {
  const src = readSource();
  expect(src).toContain("useParams");
  expect(src).toContain("id");
});

test("StatisticsPage displays 6 statistic cards", () => {
  const src = readSource();
  expect(src).toContain("参与人数");
  expect(src).toContain("已提交");
  expect(src).toContain("平均分");
  expect(src).toContain("最高分");
  expect(src).toContain("最低分");
  expect(src).toContain("通过率");
});

test("StatisticsPage renders knowledge point radar area", () => {
  const src = readSource();
  expect(src).toContain("知识点掌握率");
  expect(src).toContain("RadarChart");
});

test("StatisticsPage has student session list table", () => {
  const src = readSource();
  expect(src).toContain("<Table");
  expect(src).toContain("columns");
  expect(src).toContain("dataSource={sessions}");
});

test("StatisticsPage has detail and profile modals", () => {
  const src = readSource();
  expect(src).toContain("答题详情");
  expect(src).toContain("初级画像");
  expect(src).toContain("三维画像");
  expect(src).toContain("<Modal");
});

test("StatisticsPage has back navigation button", () => {
  const src = readSource();
  expect(src).toContain("ArrowLeftOutlined");
  expect(src).toContain("/admin/assessment");
});

test("StatisticsPage handles session status display", () => {
  const src = readSource();
  expect(src).toContain("in_progress");
  expect(src).toContain("答题中");
  expect(src).toContain("已评分");
  expect(src).toContain("graded");
});

test("StatisticsPage detail modal shows answer Collapse", () => {
  const src = readSource();
  expect(src).toContain("<Collapse");
  expect(src).toContain("student_answer");
  expect(src).toContain("correct_answer");
  expect(src).toContain("ai_feedback");
});

test("StatisticsPage uses AdminPage layout wrapper", () => {
  const src = readSource();
  expect(src).toContain("<AdminPage");
  expect(src).toContain("</AdminPage>");
});

test("StatisticsPage loads statistics and sessions on mount", () => {
  const src = readSource();
  expect(src).toContain("loadStats");
  expect(src).toContain("loadSessions");
  expect(src).toContain("useEffect");
  expect(src).toContain("useCallback");
});
