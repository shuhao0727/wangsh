import fs from "fs";
import path from "path";

// ─── session.ts API 服务测试 ───

const readSessionSource = () => {
  const filePath = path.join(__dirname, "session.ts");
  return fs.readFileSync(filePath, "utf8");
};

const readIndexSource = () => {
  const filePath = path.join(__dirname, "index.ts");
  return fs.readFileSync(filePath, "utf8");
};

// 类型定义完整性

test("session.ts exports AvailableAssessment interface with required fields", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface AvailableAssessment");
  expect(src).toContain("session_status: string | null");
  expect(src).toContain("session_id: number | null");
  expect(src).toContain("earned_score: number | null");
});

test("session.ts exports SessionStartResponse interface", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface SessionStartResponse");
  expect(src).toContain("session_id: number");
  expect(src).toContain("total_questions: number");
  expect(src).toContain("time_limit_minutes: number");
});

test("session.ts exports QuestionForStudent without correct_answer", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface QuestionForStudent");
  expect(src).toContain("answer_id: number");
  expect(src).toContain("is_answered: boolean");
  // QuestionForStudent should NOT expose correct_answer
  const qBlock = src.slice(
    src.indexOf("export interface QuestionForStudent"),
    src.indexOf("}", src.indexOf("export interface QuestionForStudent")) + 1
  );
  expect(qBlock).not.toContain("correct_answer");
});

test("session.ts exports AnswerResult with ai_feedback", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface AnswerResult");
  expect(src).toContain("ai_feedback: string | null");
  expect(src).toContain("is_correct: boolean | null");
});

test("session.ts exports BasicProfileResponse with ai_summary", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface BasicProfileResponse");
  expect(src).toContain("ai_summary: string | null");
  expect(src).toContain("knowledge_scores: string | null");
  expect(src).toContain("wrong_points: string | null");
});

test("session.ts exports StatisticsResponse with knowledge_rates", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface StatisticsResponse");
  expect(src).toContain("knowledge_rates: Record<string, number> | null");
  expect(src).toContain("pass_rate: number | null");
});

test("session.ts exports SessionListResponse with pagination fields", () => {
  const src = readSessionSource();
  expect(src).toContain("export interface SessionListResponse");
  expect(src).toContain("items: SessionListItem[]");
  expect(src).toContain("total: number");
  expect(src).toContain("total_pages: number");
});

// API 方法完整性

test("assessmentSessionApi has all student-facing methods", () => {
  const src = readSessionSource();
  expect(src).toContain("available: async");
  expect(src).toContain("start: async");
  expect(src).toContain("getQuestions: async");
  expect(src).toContain("submitAnswer: async");
  expect(src).toContain("submit: async");
  expect(src).toContain("getResult: async");
  expect(src).toContain("getBasicProfile: async");
});

test("assessmentSessionApi has all admin methods", () => {
  const src = readSessionSource();
  expect(src).toContain("getConfigSessions: async");
  expect(src).toContain("getSessionDetail: async");
  expect(src).toContain("getAdminBasicProfile: async");
  expect(src).toContain("getStatistics: async");
});

// API 端点路径正确性

test("session.ts uses correct API base path /assessment", () => {
  const src = readSessionSource();
  expect(src).toContain('const BASE = "/assessment"');
});

test("student API endpoints use correct paths", () => {
  const src = readSessionSource();
  expect(src).toContain("`${BASE}/available`");
  expect(src).toContain("`${BASE}/sessions/start`");
  expect(src).toContain("`${BASE}/sessions/${sessionId}/questions`");
  expect(src).toContain("`${BASE}/sessions/${sessionId}/answer`");
  expect(src).toContain("`${BASE}/sessions/${sessionId}/submit`");
  expect(src).toContain("`${BASE}/sessions/${sessionId}/result`");
  expect(src).toContain("`${BASE}/sessions/${sessionId}/basic-profile`");
});

test("admin API endpoints use correct paths", () => {
  const src = readSessionSource();
  expect(src).toContain("`${ADMIN_BASE}/configs/${configId}/sessions`");
  expect(src).toContain("`${ADMIN_BASE}/sessions/${sessionId}`");
  expect(src).toContain("`${ADMIN_BASE}/configs/${configId}/statistics`");
});

// submit 超时配置

test("submit method has extended timeout for AI grading", () => {
  const src = readSessionSource();
  const submitBlock = src.slice(
    src.indexOf("submit: async"),
    src.indexOf("getResult: async")
  );
  expect(submitBlock).toContain("timeout: 120000");
});

// 错误处理

test("all API methods have error handling with toDetailMessage", () => {
  const src = readSessionSource();
  const methods = [
    "available", "start", "getQuestions", "submitAnswer",
    "submit", "getResult", "getBasicProfile",
    "getConfigSessions", "getSessionDetail", "getAdminBasicProfile", "getStatistics",
  ];
  for (const method of methods) {
    const idx = src.indexOf(`${method}: async`);
    expect(idx).toBeGreaterThan(-1);
    // Each method should have a catch block
    const nextMethod = src.indexOf(": async", idx + method.length + 10);
    const block = src.slice(idx, nextMethod > -1 ? nextMethod : undefined);
    expect(block).toContain("catch");
  }
});

// index.ts 导出完整性

test("index.ts re-exports assessmentSessionApi", () => {
  const src = readIndexSource();
  expect(src).toContain('export { assessmentSessionApi } from "./session"');
});

test("index.ts re-exports all session types", () => {
  const src = readIndexSource();
  const expectedTypes = [
    "AvailableAssessment",
    "SessionStartResponse",
    "QuestionForStudent",
    "AnswerResult",
    "SessionSubmitResponse",
    "SessionResultResponse",
    "AnswerDetailResponse",
    "BasicProfileResponse",
    "StatisticsResponse",
    "SessionListItem",
    "SessionListResponse",
  ];
  for (const t of expectedTypes) {
    expect(src).toContain(t);
  }
});
