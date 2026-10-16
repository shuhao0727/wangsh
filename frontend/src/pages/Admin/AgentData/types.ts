// Shared types for AgentData pages and components

export type WordCloudItem = { word: string; count: number };
export type TopicItem = {
  topic: string;
  questions?: string[];
  count: number;
  unique_students?: number;
  evidence_ids?: number[];
  representative_question?: string;
};
export type MainQuestionChainItem = { stage: string; question: string; reason?: string; evidence?: string[] };

export type TeacherQuestionItem = { id?: string; time?: string; question: string; source?: string; user_name?: string };
export type TeacherMark = { time: string; question: string };
export type StudentQuestionChainSource = "saved" | "live" | "beam" | "evidence";

export type StudentChainNode = {
  question?: string;
  time?: string;
  question_type?: string;
  question_type_label?: string;
  bloom_level?: string;
  teacher_anchor_id?: string;
  teacher_anchor_question?: string;
  teacherQuestion?: string;
  teacherTime?: string;
  evidence_ids?: number[];
};

export type AnalysisAgentStatus = {
  id?: number | null;
  name?: string | null;
  model_name?: string | null;
  agent_type?: string | null;
  role?: string;
  enabled?: boolean;
  status?: string;
  reason?: string | null;
};

export type DeepAnalysisStatus = {
  enabled?: boolean;
  status?: string;
  reason?: string | null;
};

export type HotDeepThemeAnalysis = {
  theme?: string;
  question_count?: number;
  unique_students?: number;
  bloom_distribution?: Record<string, number>;
  overall_bloom_level?: string;
  representative_questions?: string[];
  covered_by_task_sheet?: boolean;
  student_behavior?: string;
  diagnosis?: string;
};

export type HotDeepAnalysis = {
  data_profile?: {
    summary?: string;
    noise_ratio?: string;
    noise_types?: string[];
    participation_pattern?: string;
  };
  theme_analysis?: HotDeepThemeAnalysis[];
  timeline_phases?: Array<{
    phase_index?: number;
    phase_name?: string;
    time_range?: string;
    question_count?: number;
    dominant_themes?: string[];
    bloom_profile?: string;
    phase_description?: string;
    transition_driver?: string;
    insight?: string;
  }>;
  task_sheet_analysis?: {
    covered_topics?: string[];
    blind_spots?: Array<{ topic?: string; actual_questions?: number; insight?: string }>;
    underperformed_topics?: Array<{ topic?: string; possible_reason?: string }>;
    bloom_gap_analysis?: string;
  };
  teaching_suggestions?: Array<{
    priority?: string;
    category?: string;
    observation?: string;
    root_cause?: string;
    suggested_action?: string;
    expected_effect?: string;
    target_students?: string[];
    verification_indicator?: string;
  }>;
  class_comparison?: Record<string, unknown>;
  executive_summary?: string;
};

export type ChainDeepAnalysis = {
  participation_profile?: {
    total_students_with_questions?: number;
    avg_questions_per_student?: number;
    student_categories?: Record<string, { count?: number; names?: string[]; description?: string }>;
    class_bloom_distribution?: Record<string, number>;
  };
  cognitive_trajectories?: Array<{
    student_name?: string;
    class_name?: string;
    question_count?: number;
    questions_sequence?: Array<{ time?: string; question?: string; bloom_level?: string }>;
    trajectory_type?: string;
    confidence?: string;
    bloom_progression?: string[];
    overall_trend?: string;
    key_turning_point?: { question?: string; change?: string };
    root_cause?: string;
    learning_suggestion?: string;
    alternative_trajectory?: string;
  }>;
  chain_reactions?: Array<Record<string, unknown>>;
  teacher_question_evaluations?: Array<{
    teacher_question_id?: string;
    teacher_question?: string;
    triggered_count?: number;
    triggered_bloom_distribution?: Record<string, number>;
    effectiveness_score?: number;
    evaluation?: string;
    improvement_suggestion?: string;
  }>;
  learning_gaps?: {
    universal_gaps?: Array<{ gap_name?: string; severity?: string; affected_count?: number; affected_students?: string[]; evidence?: string[]; root_cause?: string; intervention?: string }>;
    individual_gaps?: Array<{ student?: string; gap?: string; evidence?: string; intervention?: string }>;
    cognitive_ceiling?: { bloom_level?: string; percentage_stuck?: string; barrier_description?: string; breakthrough_strategy?: string };
  };
  intervention_plan?: {
    whole_class?: Array<{ target_gap?: string; action?: string; when?: string }>;
    small_group?: Array<{ target_students?: string[]; common_issue?: string; action?: string }>;
    individual?: Array<{ student?: string; current_state?: string; goal?: string; action?: string; urgency?: string }>;
  };
  class_differences?: Record<string, unknown>;
  executive_summary?: string;
  unresolved_items?: Array<Record<string, unknown>>;
  low_confidence_items?: Array<Record<string, unknown>>;
};

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
  questions?: StudentChainNode[];
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
  teacher_anchor_id?: string;
  teacher_anchor_question?: string;
  teacher_question?: string;
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
  summary?: { question_count?: number; unique_students?: number; burst_count?: number };
  ai_main_question_chain?: Array<{ stage?: string; question?: string; next_ai_question?: string; reason?: string; evidence?: string[]; student_response_summary?: string }>;
  student_question_chains?: StudentQuestionChainItem[];
  student_chains?: StudentQuestionChainItem[];
  student_chain_summary?: { chain_count?: number; question_count?: number; unique_students?: number; teacher_anchor_count?: number; ai_chain_node_count?: number; dominant_question_type?: string };
  beam_nodes?: BeamNode[];
  timeline_buckets?: Array<{
    bucket_start?: string;
    bucket_end?: string;
    start_at?: string;
    end_at?: string;
    question_count?: number;
    unique_students?: number;
    top_questions?: Array<{ question?: string; count?: number }>;
    is_burst?: boolean;
    near_teacher_mark?: string | null;
  }>;
  result?: TaskAnalysisResult;
  deep_analysis?: HotDeepAnalysis | ChainDeepAnalysis;
  deep_analysis_status?: DeepAnalysisStatus;
  analysis_agent?: AnalysisAgentStatus;
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
  bloomLevel?: string;
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
  bloomLevel?: string;
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
