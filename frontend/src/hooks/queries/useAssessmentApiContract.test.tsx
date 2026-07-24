import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAdaptiveKPs,
} from "./useAssessmentQuery";
import {
  useGradedStudents,
} from "./useAssessmentStatisticsQuery";

const mocks = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  getConfigSessions: vi.fn(),
}));

vi.mock("@services/assessment", () => ({
  assessmentConfigApi: {},
  assessmentQuestionApi: {
    list: mocks.listQuestions,
  },
  assessmentSessionApi: {
    getConfigSessions: mocks.getConfigSessions,
  },
  profileApi: {},
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const makeQuestion = (id: number, mode: "fixed" | "adaptive") => ({
  id,
  config_id: 1,
  question_type: "choice" as const,
  content: `Question ${id}`,
  options: null,
  correct_answer: "A",
  score: 1,
  difficulty: "easy" as const,
  knowledge_point: `KP ${id}`,
  explanation: null,
  source: "manual" as const,
  mode,
  adaptive_config: null,
  created_at: "2026-07-22T00:00:00Z",
});

const makeSession = (id: number) => ({
  id,
  user_id: id,
  user_name: `Student ${id}`,
  class_name: "Class 1",
  status: "graded",
  earned_score: 80,
  total_score: 100,
  started_at: "2026-07-22T00:00:00Z",
  submitted_at: "2026-07-22T00:10:00Z",
  created_at: "2026-07-22T00:00:00Z",
});

describe("Assessment API pagination contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads all adaptive questions without exceeding the backend limit of 200", async () => {
    mocks.listQuestions.mockImplementation(
      async (_configId: number, params?: { skip?: number; limit?: number }) => {
        if ((params?.limit ?? 0) > 200) {
          throw new Error("422: limit must be less than or equal to 200");
        }

        if ((params?.skip ?? 0) === 0) {
          return {
            items: Array.from({ length: 200 }, (_, index) =>
              makeQuestion(index + 1, index === 199 ? "adaptive" : "fixed"),
            ),
            total: 201,
            page: 1,
            page_size: 200,
            total_pages: 2,
          };
        }

        return {
          items: [makeQuestion(201, "adaptive")],
          total: 201,
          page: 2,
          page_size: 200,
          total_pages: 2,
        };
      },
    );

    const { result } = renderHook(() => useAdaptiveKPs(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.error).toBeNull();
    expect(mocks.listQuestions).toHaveBeenNthCalledWith(1, 1, {
      skip: 0,
      limit: 200,
    });
    expect(mocks.listQuestions).toHaveBeenNthCalledWith(2, 1, {
      skip: 200,
      limit: 200,
    });
    expect(result.current.data?.map((item) => item.key)).toEqual([
      "200",
      "201",
    ]);
  });

  it("loads all graded students without exceeding the backend limit of 100", async () => {
    mocks.getConfigSessions.mockImplementation(
      async (
        _configId: number,
        params?: { status?: string; skip?: number; limit?: number },
      ) => {
        if ((params?.limit ?? 0) > 100) {
          throw new Error("422: limit must be less than or equal to 100");
        }

        if ((params?.skip ?? 0) === 0) {
          return {
            items: Array.from({ length: 100 }, (_, index) =>
              makeSession(index + 1),
            ),
            total: 101,
            page: 1,
            page_size: 100,
            total_pages: 2,
          };
        }

        return {
          items: [makeSession(101)],
          total: 101,
          page: 2,
          page_size: 100,
          total_pages: 2,
        };
      },
    );

    const { result } = renderHook(() => useGradedStudents(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.error).toBeNull();
    expect(mocks.getConfigSessions).toHaveBeenNthCalledWith(1, 1, {
      status: "graded",
      skip: 0,
      limit: 100,
    });
    expect(mocks.getConfigSessions).toHaveBeenNthCalledWith(2, 1, {
      status: "graded",
      skip: 100,
      limit: 100,
    });
    expect(result.current.data).toHaveLength(101);
  });
});
