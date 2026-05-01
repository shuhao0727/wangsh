/**
 * Centralized TanStack Query key factory.
 *
 * Every query and invalidation should use these keys so that cache
 * structure is consistent and refactors are safe.
 */
export const queryKeys = {
  // ── Agent Data (UsageRecordPanel + DetailModal) ──
  agentData: {
    all: ["agent-data"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.agentData.all, "list", params] as const,
    conversation: (sessionId: string) =>
      [...queryKeys.agentData.all, "conversation", sessionId] as const,
  },

  // ── Group Discussion ──
  discussion: {
    all: ["group-discussion"] as const,
    sessions: (params: Record<string, unknown>) =>
      [...queryKeys.discussion.all, "sessions", params] as const,
    messages: (sessionId: number) =>
      [...queryKeys.discussion.all, "messages", sessionId] as const,
    members: (sessionId: number) =>
      [...queryKeys.discussion.all, "members", sessionId] as const,
    analyses: (sessionId: number) =>
      [...queryKeys.discussion.all, "analyses", sessionId] as const,
    publicConfig: () =>
      [...queryKeys.discussion.all, "public-config"] as const,
    allAgents: () =>
      [...queryKeys.discussion.all, "all-agents"] as const,
  },

  // ── Assessment Configs ──
  assessment: {
    all: ["assessment-configs"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.assessment.all, params] as const,
    detail: (id: number) =>
      [...queryKeys.assessment.all, "detail", id] as const,
    editor: (id: number) =>
      [...queryKeys.assessment.all, "editor", id] as const,
  },

  // ── Assessment Questions ──
  assessmentQuestions: {
    all: ["assessment-questions"] as const,
    list: (configId: number, params: Record<string, unknown>) =>
      [...queryKeys.assessmentQuestions.all, configId, params] as const,
    adaptive: (configId: number) =>
      [...queryKeys.assessmentQuestions.all, configId, "adaptive"] as const,
  },

  // ── Assessment Statistics & Sessions ──
  assessmentStats: {
    all: ["assessment-statistics"] as const,
    statistics: (
      configId: number,
      params?: Record<string, unknown>,
    ) =>
      [...queryKeys.assessmentStats.all, configId, "statistics", params] as const,
    sessions: (configId: number, params: Record<string, unknown>) =>
      [...queryKeys.assessmentStats.all, configId, "sessions", params] as const,
    classNames: (configId: number) =>
      [...queryKeys.assessmentStats.all, configId, "classNames"] as const,
    gradedStudents: (configId: number) =>
      [...queryKeys.assessmentStats.all, configId, "gradedStudents"] as const,
    sessionDetail: (sessionId: number | null) =>
      [...queryKeys.assessmentStats.all, "sessionDetail", sessionId] as const,
    studentProfile: (
      sessionId: number | null,
      userId: number | null,
      configId?: number | null,
    ) =>
      [
        ...queryKeys.assessmentStats.all,
        "studentProfile",
        configId ?? null,
        sessionId,
        userId,
      ] as const,
  },

  // ── AI Agents ──
  aiAgents: {
    all: ["ai-agents"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.aiAgents.all, params] as const,
    statistics: () =>
      [...queryKeys.aiAgents.all, "statistics"] as const,
  },

  // ── Articles ──
  articles: {
    all: ["articles"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.articles.all, params] as const,
  },

  // ── Classroom Plans ──
  classroomPlans: {
    all: ["classroom-plans"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.classroomPlans.all, params] as const,
    detail: (id: number) =>
      [...queryKeys.classroomPlans.all, "detail", id] as const,
  },

  // ── Classroom Activities ──
  classroom: {
    all: ["classroom-activities"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.classroom.all, params] as const,
    detail: (id: number | null) =>
      [...queryKeys.classroom.all, "detail", id] as const,
  },

  // ── Active Agents (classroom interaction) ──
  activeAgents: {
    all: ["active-agents"] as const,
  },

  // ── Users ──
  users: {
    all: ["users"] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.users.all, params] as const,
  },
} as const;
