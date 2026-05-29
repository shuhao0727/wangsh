// Shared types for AgentData pages and components

export type WordCloudItem = { word: string; count: number };
export type TopicItem = { topic: string; questions?: string[]; count: number };
export type MainQuestionChainItem = { stage: string; question: string; reason?: string; evidence?: string[] };

export type TeacherQuestionItem = { id?: string; time?: string; question: string; source?: string; user_name?: string };
export type TeacherMark = { time: string; question: string };
export type StudentQuestionChainSource = "saved" | "live" | "beam" | "evidence";

export type StudentChainNode = { question?: string; time?: string; question_type_label?: string; bloom_level?: string; evidence_ids?: number[] };

export type StudentQuestionChainItem = {
  session_id: string;
  student_name?: string;
  class_name?: string;
  question_count?: number;
  start_at?: string;
  end_at?: string;
  summary?: string;
  source?: StudentQuestionChainSource;
  source_label?: string;
  is_evidence_only?: boolean;
  nodes?: StudentChainNode[];
};

export type BeamNode = {
  id: string;
  kind: "teacher_anchor" | "student_question" | string;
  label?: string;
  time?: string;
  lane?: string;
  y_order?: number;
  student_name?: string;
  question_type?: string;
  question_type_label?: string;
  bloom_level?: string;
  evidence_ids?: number[];
};

export type TaskAnalysisResult = {
  word_cloud?: WordCloudItem[];
  wordCloud?: WordCloudItem[];
  keywords?: WordCloudItem[];
  hot_words?: WordCloudItem[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
  main_question_chain?: MainQuestionChainItem[];
  themes?: Array<TopicItem & { theme_id?: string; unique_students?: number; evidence_ids?: number[]; representative_question?: string }>;
  burst_points?: Array<{ bucket_start: string; question_count: number; top_questions?: Array<{ question: string; count: number }> }>;
  teacher_questions?: TeacherQuestionItem[];
  teacher_mainline?: TeacherQuestionItem[];
  teacher_marks?: TeacherQuestionItem[];
  course_hotspot_sequence?: Array<{ stage: string; start_at?: string; end_at?: string; teacher_question?: string; dominant_theme?: string; phase_type?: string; question_count?: number; unique_students?: number; representative_questions?: string[] }>;
  teaching_suggestions?: Array<{ theme?: string; priority?: string; reason?: string; suggestion?: string }>;
  ai_main_question_chain?: Array<{ stage?: string; question?: string; next_ai_question?: string; reason?: string; evidence?: string[]; student_response_summary?: string }>;
  student_question_chains?: StudentQuestionChainItem[];
  student_chain_summary?: { chain_count?: number; question_count?: number; unique_students?: number; teacher_anchor_count?: number; ai_chain_node_count?: number; dominant_question_type?: string };
  beam_nodes?: BeamNode[];
  timeline_buckets?: Array<{
    bucket_start?: string;
    start_at?: string;
    end_at?: string;
    question_count?: number;
    unique_students?: number;
    top_questions?: Array<{ question?: string; count?: number }>;
  }>;
  result?: TaskAnalysisResult;
};

export type TaskAnalysisDetail = {
  id?: number;
  title?: string;
  task_sheet?: string;
  created_at?: string;
  agent_id?: number;
  start_at?: string;
  end_at?: string;
  class_name?: string;
  result?: TaskAnalysisResult;
  word_cloud?: WordCloudItem[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
};

export type ChainMessage = { id?: number; message_type: string; content: string; created_at: string };
export type ChainSession = {
  session_id: string;
  user_name?: string;
  class_name?: string;
  last_at: string;
  turns: number;
  messages: ChainMessage[];
};
export type ChainSummary = {
  sessionId: string;
  studentName: string;
  className?: string;
  questionCount: number;
  startAt?: string;
  endAt?: string;
  questions: ChainMessage[];
};

export type BeamRangeQuestion = {
  chainId: string;
  time: string;
  studentName: string;
  content: string;
  relationType?: BeamRelationType;
  relationLabel?: string;
  teacherQuestion?: string;
  teacherTime?: string;
  isUncovered?: boolean;
  evidenceIds?: number[];
};

export type BeamRangeSelection = {
  startAt?: string;
  endAt?: string;
  questions: BeamRangeQuestion[];
  teacherAnchors?: BeamTeacherAnchor[];
  source?: "initial" | "zoom" | "brush" | "manual";
};

export type BeamRelationType = "clarify" | "follow_up" | "apply" | "debug" | "challenge" | "transfer" | "extend" | "off_track";

export type BeamTeacherAnchor = {
  id: string;
  time: string;
  question: string;
  label?: string;
};

export type BeamQuestionNode = {
  id: string;
  time: string;
  content: string;
  relationType: BeamRelationType;
  relationLabel: string;
  teacherQuestion?: string;
  teacherTime?: string;
  isUncovered?: boolean;
  evidenceIds?: number[];
};

export type BeamStudentChain = {
  id: string;
  studentName: string;
  className?: string;
  startAt?: string;
  endAt?: string;
  questionCount: number;
  summary?: string;
  source?: StudentQuestionChainSource;
  sourceLabel?: string;
  isEvidenceOnly?: boolean;
  nodes: BeamQuestionNode[];
};
