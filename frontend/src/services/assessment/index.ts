// 自主检测服务统一导出

export { assessmentConfigApi } from "./config";
export type {
  AssessmentConfig,
  AssessmentConfigAgent,
  AssessmentConfigListResponse,
  AssessmentConfigCreateRequest,
  AssessmentConfigUpdateRequest,
} from "./config";

export { assessmentQuestionApi } from "./question";
export type {
  AssessmentQuestion,
  QuestionListResponse,
  QuestionCreateRequest,
  QuestionUpdateRequest,
  GenerateResult,
} from "./question";

export { assessmentSessionApi } from "./session";
export type {
  AvailableAssessment,
  SessionStartResponse,
  QuestionForStudent,
  AnswerResult,
  SessionSubmitResponse,
  SessionResultResponse,
  AnswerDetailResponse,
  BasicProfileResponse,
  StatisticsResponse,
  SessionListItem,
  SessionListResponse,
} from "./session";

export { profileApi } from "./profile";
export type {
  StudentProfile,
  ProfileListResponse,
  ProfileGenerateRequest,
  ProfileBatchGenerateRequest,
} from "./profile";
