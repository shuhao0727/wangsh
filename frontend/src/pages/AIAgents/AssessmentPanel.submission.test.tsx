import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentSessionApi, type AnswerResult, type QuestionForStudent } from "@services/assessment";
import { showMessage } from "@/lib/toast";
import AssessmentPanel from "./AssessmentPanel";

// Real panel, portal, inputs, buttons and Radix confirmation dialog; only service
// boundaries and unrelated profile rendering are replaced. This is not full E2E.
vi.mock("@services/assessment", () => ({
  assessmentSessionApi: {
    available: vi.fn(), start: vi.fn(), getQuestions: vi.fn(), submitAnswer: vi.fn(),
    submit: vi.fn(), getResult: vi.fn(), getProfileStatus: vi.fn(), getBasicProfile: vi.fn(),
  },
  profileApi: { getMyProfiles: vi.fn() },
}));
vi.mock("@components/ProfileView", () => ({
  BasicProfileView: () => null, AdvancedProfileView: () => null, AdvancedProfileEmpty: () => null,
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(), info: vi.fn() },
}));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const answerResult: AnswerResult = {
  answer_id: 101, question_type: "fill", is_correct: true, correct_answer: "42",
  explanation: null, earned_score: 5, max_score: 5, ai_feedback: null,
};
const question = (type = "fill", id = 101): QuestionForStudent => ({
  answer_id: id, question_type: type, content: `合成题 ${id}`, score: 5,
  options: type === "choice" ? '["A. 四十二","B. 七"]' : null,
  student_answer: null, is_answered: false,
});
const button = (name: string) => screen.getByRole("button", { name });
const confirm = () => fireEvent.click(button("确认"));
const requestSubmit = () => fireEvent.click(button("提交检测"));
const confirmIfOpen = () => { if (screen.queryByRole("button", { name: "确认" })) confirm(); };
const typeAnswer = (text = "42") => fireEvent.change(screen.getByPlaceholderText("输入答案"), { target: { value: text } });
const save = () => fireEvent.click(button("提交"));
const openQuiz = async (questions = [question()]) => {
  vi.mocked(assessmentSessionApi.getQuestions).mockResolvedValue(questions);
  const view = render(<AssessmentPanel isAuthenticated isStudent isAdmin={false} userId={7} />);
  fireEvent.click(button("自我评价"));
  fireEvent.click(await screen.findByRole("button", { name: "开始检测" }));
  await screen.findByText(questions[0].content);
  return view;
};
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(assessmentSessionApi.available).mockResolvedValue([{
    id: 1, title: "合成检测", total_score: 5, time_limit_minutes: 1,
    session_status: null, session_id: null, earned_score: null,
  }]);
  vi.mocked(assessmentSessionApi.start).mockResolvedValue({
    session_id: 10, config_title: "合成检测", total_questions: 1, total_score: 5,
    time_limit_minutes: 1, started_at: new Date().toISOString(),
  });
  vi.mocked(assessmentSessionApi.submitAnswer).mockResolvedValue(answerResult);
  vi.mocked(assessmentSessionApi.submit).mockResolvedValue({
    session_id: 10, status: "graded", earned_score: 5, total_score: 5, basic_profile_id: null, summary: null,
  });
  vi.mocked(assessmentSessionApi.getResult).mockResolvedValue({
    session_id: 10, config_id: 1, config_title: "合成检测", status: "graded",
    earned_score: 5, total_score: 5, started_at: null, submitted_at: null,
    answers: [], basic_profile_id: null,
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("AssessmentPanel submission interlock (real component, synthetic API)", () => {
  it("blocks pending answer settlement then permits explicit submission", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz(); typeAnswer(); save(); requestSubmit(); confirmIfOpen();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    await act(async () => pending.resolve(answerResult));
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.getResult).toHaveBeenCalledOnce());
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledWith(10, { answer_id: 101, student_answer: "42" });
    expect(assessmentSessionApi.submit).toHaveBeenCalledOnce();
  });
  it("rechecks a confirmation opened before short-answer blur starts saving", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz([question("short_answer")]);
    const textarea = screen.getByPlaceholderText("输入答案");
    typeAnswer("保留这份答案");
    // Real React events in one batch, including a delayed blur after dialog open.
    act(() => { button("提交检测").click(); fireEvent.blur(textarea); });
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledOnce();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    confirm();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    await act(async () => pending.resolve(answerResult));
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
  });
  it("blocks settlement after save rejection and preserves retryable input", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz(); typeAnswer(); save();
    await act(async () => pending.reject(new Error("保存失败，请重试")));
    expect(showMessage.error).toHaveBeenCalledWith("保存失败，请重试");
    expect(screen.getByPlaceholderText("输入答案")).toHaveValue("42");
    requestSubmit(); confirmIfOpen();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    save();
    await waitFor(() => expect(screen.getByPlaceholderText("输入答案")).toBeDisabled());
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledTimes(2);
  });
  it("does not silently discard an unsaved fill draft", async () => {
    await openQuiz(); typeAnswer(); requestSubmit(); confirmIfOpen();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("输入答案")).toHaveValue("42");
    expect(showMessage.warning).toHaveBeenCalled();
  });
  it("deduplicates same-batch confirmation and blocks answers during settlement", async () => {
    const pending = deferred<Awaited<ReturnType<typeof assessmentSessionApi.submit>>>();
    vi.mocked(assessmentSessionApi.submit).mockReturnValueOnce(pending.promise);
    await openQuiz(); requestSubmit();
    const yes = button("确认");
    act(() => { yes.click(); yes.click(); });
    expect(assessmentSessionApi.submit).toHaveBeenCalledOnce();
    const input = screen.getByPlaceholderText("输入答案");
    fireEvent.change(input, { target: { value: "late" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(assessmentSessionApi.submitAnswer).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ session_id: 10, status: "graded", earned_score: 0, total_score: 5, basic_profile_id: null, summary: null }));
    await waitFor(() => expect(assessmentSessionApi.getResult).toHaveBeenCalledOnce());
  });
  it("unlocks after settlement failure for explicit retry", async () => {
    vi.mocked(assessmentSessionApi.submit).mockRejectedValueOnce(new Error("整卷提交失败"));
    await openQuiz(); requestSubmit(); confirm();
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith({ content: "整卷提交失败", key: "submit" }));
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.getResult).toHaveBeenCalledOnce());
    expect(assessmentSessionApi.submit).toHaveBeenCalledTimes(2);
  });
  it("retries result loading without submitting the session twice", async () => {
    vi.mocked(assessmentSessionApi.getResult).mockRejectedValueOnce(new Error("结果加载失败"));
    await openQuiz(); requestSubmit(); confirm();
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith({ content: "结果加载失败", key: "submit" }));
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.getResult).toHaveBeenCalledTimes(2));
    expect(assessmentSessionApi.submit).toHaveBeenCalledOnce();
  });
  it("retains a failed choice and offers explicit retry", async () => {
    vi.mocked(assessmentSessionApi.submitAnswer).mockRejectedValueOnce(new Error("选择保存失败"));
    await openQuiz([question("choice")]);
    fireEvent.click(screen.getByRole("radio", { name: "A. 四十二" }));
    await waitFor(() => expect(showMessage.error).toHaveBeenCalledWith("选择保存失败"));
    expect(screen.getByRole("radio", { name: "A. 四十二" })).toBeChecked();
    requestSubmit(); confirmIfOpen();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    fireEvent.click(button("重试保存"));
    await waitFor(() => expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledTimes(2));
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
  });
  it("preserves drafts across question navigation", async () => {
    await openQuiz([question(), question("fill", 102)]); typeAnswer("未保存草稿");
    fireEvent.click(button("下一题")); fireEvent.click(button("上一题"));
    expect(screen.getByPlaceholderText("输入答案")).toHaveValue("未保存草稿");
  });
  it("does not auto-settle at countdown expiry or after answer timeout", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz(); typeAnswer(); save();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
    await screen.findByText("00:00", {}, { timeout: 2000 });
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    await act(async () => pending.reject(new Error("timeout of 120000ms exceeded")));
    requestSubmit(); confirmIfOpen();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    expect(showMessage.error).toHaveBeenCalledWith("timeout of 120000ms exceeded");
    expect(screen.getByPlaceholderText("输入答案")).toHaveValue("42");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledOnce();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    save();
    await waitFor(() => expect(screen.getByPlaceholderText("输入答案")).toBeDisabled());
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledTimes(2);
  });
  it("blocks an answer event in the same React batch as settlement", async () => {
    const pending = deferred<Awaited<ReturnType<typeof assessmentSessionApi.submit>>>();
    vi.mocked(assessmentSessionApi.submit).mockReturnValueOnce(pending.promise);
    await openQuiz([question("choice")]);
    const radio = screen.getByRole("radio", { name: "A. 四十二" });
    requestSubmit();
    const yes = button("确认");
    act(() => { yes.click(); radio.click(); });
    expect(assessmentSessionApi.submit).toHaveBeenCalledOnce();
    expect(assessmentSessionApi.submitAnswer).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ session_id: 10, status: "graded", earned_score: 0, total_score: 5, basic_profile_id: null, summary: null }));
  });
  it("blocks a stale confirmation after short-answer timeout without blur retry loops", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz([question("short_answer")]); typeAnswer("超时后保留");
    const textarea = screen.getByPlaceholderText("输入答案");
    act(() => { button("提交检测").click(); fireEvent.blur(textarea); });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await act(async () => pending.reject(new Error("timeout")));
    confirm();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    expect(showMessage.error).toHaveBeenCalledWith("timeout");
    expect(textarea).toHaveValue("超时后保留");
    fireEvent.focus(textarea); fireEvent.blur(textarea);
    fireEvent.focus(textarea); fireEvent.blur(textarea);
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledOnce();
    fireEvent.click(button("保存"));
    await waitFor(() => expect(textarea).toBeDisabled());
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
  });
  it("allows cancelling confirmation without discarding a draft", async () => {
    await openQuiz(); typeAnswer(); requestSubmit();
    fireEvent.click(button("取消"));
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("输入答案")).toHaveValue("42");
    save();
    await waitFor(() => expect(screen.getByPlaceholderText("输入答案")).toBeDisabled());
    requestSubmit(); confirm();
    await waitFor(() => expect(assessmentSessionApi.submit).toHaveBeenCalledOnce());
  });
  it("deduplicates answer Enter/click and keeps adaptive follow-up", async () => {
    const pending = deferred<AnswerResult>();
    vi.mocked(assessmentSessionApi.submitAnswer).mockReturnValueOnce(pending.promise);
    await openQuiz(); typeAnswer();
    const input = screen.getByPlaceholderText("输入答案"); const submitAnswer = button("提交");
    act(() => { fireEvent.keyDown(input, { key: "Enter" }); submitAnswer.click(); });
    expect(assessmentSessionApi.submitAnswer).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ...answerResult, next_question: {
      answer_id: 102, question_type: "fill", content: "自适应合成题", options: null,
      score: 5, is_adaptive: true, knowledge_point: "合成知识点", attempt_seq: 2,
    } }));
    fireEvent.click(button("下一题"));
    expect(screen.getByText("自适应合成题")).toBeInTheDocument();
    expect(assessmentSessionApi.submit).not.toHaveBeenCalled();
  });
});
