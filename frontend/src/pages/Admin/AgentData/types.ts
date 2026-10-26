// Shared types for AgentData pages and components

export type WordCloudItem = { word: string; count: number };

export type HotnessComponent = {
  score?: number;
  weight?: number;
  contribution?: number;
  evidence?: string;
};

export type TopicItem = {
  topic: string;
  questions?: string[];
  count: number;
  unique_students?: number;
  evidence_ids?: number[];
  representative_question?: string;
  theme_id?: string;
  intent_code?: string;
  intent_label?: string;
  keywords?: WordCloudItem[];
  active_bucket_count?: number;
  commonness_score?: number;
  difficulty_signal_score?: number;
  persistence_score?: number;
  hotness_score?: number;
  hotness_components?: Record<string, HotnessComponent>;
  hotness_explanation?: string[];
  score_basis?: string;
  heat_profile?: string;
};
export type MainQuestionChainItem = { stage: string; question: string; reason?: string; evidence?: string[] };

export type TeacherQuestionItem = { id?: string; time?: string; question: string; source?: string; user_name?: string };

export type HotStudentQuestionEvent = {
  message_id?: number;
  created_at?: string;
  content?: string;
  question?: string;
  user_name?: string;
  user_id?: number;
  student_id?: number;
  class_name?: string;
  session_id?: string;
  quality_label?: string;
  quality_reason?: string;
  quality_flags?: string[];
  included_in_analysis?: boolean;
  theme?: string;
  intent_label?: string;
  question_type?: string;
  question_type_label?: string;
  teacher_anchor_id?: string | null;
  teacher_anchor_question?: string | null;
  teacher_anchor_score?: number | null;
  teacher_anchor_confidence?: string | null;
  teacher_anchor_match_type?: string | null;
  teacher_anchor_reason?: string[];
  trigger_delay_seconds?: number | null;
};

export type HotDataQuality = {
  raw_count?: number;
  raw_event_count?: number;
  valid_question_count?: number;
  prompt_echo_count?: number;
  duplicate_count?: number;
  off_track_count?: number;
  too_short_count?: number;
  noise_count?: number;
  excluded_count?: number;
  prompt_echo_rate?: number;
  noise_rate?: number;
};

export type HotAnalysisAudit = {
  audit_version?: string;
  raw_event_count?: number;
  raw_student_event_count?: number;
  valid_question_count?: number;
  excluded_event_count?: number;
  teacher_anchor_denominator?: number;
  teacher_anchor_match_count?: number;
  teacher_anchor_coverage?: number;
  teacher_anchor_confidence_total?: number;
  teacher_anchor_statistics_consistent?: boolean;
  warnings?: string[];
};
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
  hotness_score?: number;
  heat_profile?: string;
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

/** LLM 逐条归类：回应型挂教师提问 Tn，生成性与无关不挂。 */
export type HotQuestionCategory = "response" | "generative" | "unrelated";
export type HotQuestionLabel = {
  category: HotQuestionCategory;
  subtype: string | null;
  teacher_ref: string | null;
  reason?: string;
  /** 多轮判定的一致程度，1 表示每轮相同。 */
  agreement?: number;
  /** 多数票不足，判为待确认。 */
  ambiguous?: boolean;
  votes?: number;
};
export type HotTeacherRef = { ref: string; time?: string; question: string; message_id?: number | null };
export type HotClassificationTeacher = HotTeacherRef & {
  response_count: number;
  subtypes: Record<string, number>;
};
export type HotQuestionClassification = {
  version?: string;
  category_labels?: Record<string, string>;
  subtype_labels?: Record<string, string>;
  items?: Record<string, HotQuestionLabel>;
  totals?: { response: number; generative: number; unrelated: number; unclassified: number };
  ambiguous_count?: number;
  unlabelled_count?: number;
  vote_rounds?: number;
  subtypes?: Record<string, number>;
  teachers?: HotClassificationTeacher[];
  /** 去重后的教师提问清单（含 Tn 编号），页面按它编号。 */
  teacher_refs?: HotTeacherRef[];
  batch_count?: number;
  failed_batch_count?: number;
};

export type TaskAnalysisResult = {
  question_classification?: HotQuestionClassification;
  classification_status?: { enabled?: boolean; status?: "completed" | "partial" | "empty" | "skipped"; reason?: string | null };
  analysis_version?: string;
  bucket_seconds?: number;
  word_cloud?: WordCloudItem[];
  wordCloud?: WordCloudItem[];
  keywords?: WordCloudItem[];
  hot_words?: WordCloudItem[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
  main_question_chain?: MainQuestionChainItem[];
  themes?: Array<TopicItem & { theme_id?: string; unique_students?: number; evidence_ids?: number[]; representative_question?: string }>;
  burst_points?: Array<{
    bucket_start: string;
    question_count: number;
    top_questions?: Array<{ question: string; count: number }>;
    burst_score?: number;
    burst_reasons?: string[];
  }>;
  teacher_questions?: TeacherQuestionItem[];
  teacher_mainline?: TeacherQuestionItem[];
  teacher_marks?: TeacherQuestionItem[];
  course_hotspot_sequence?: Array<{ stage: string; start_at?: string; end_at?: string; teacher_question?: string; dominant_theme?: string; phase_type?: string; question_count?: number; unique_students?: number; representative_questions?: string[] }>;
  teaching_suggestions?: Array<{ theme?: string; priority?: string; reason?: string; suggestion?: string }>;
  summary?: {
    question_count?: number;
    valid_question_count?: number;
    raw_count?: number;
    unique_students?: number;
    burst_count?: number;
    prompt_echo_count?: number;
    duplicate_count?: number;
    noise_count?: number;
    teacher_anchor_count?: number;
    teacher_anchor_match_count?: number;
    teacher_anchor_coverage?: number;
    teacher_anchor_confidence_distribution?: Record<string, number>;
    top_hotness_score?: number;
  };
  data_quality?: HotDataQuality;
  analysis_audit?: HotAnalysisAudit;
  student_question_events?: HotStudentQuestionEvent[];
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
    student_ids?: number[];
    evidence_ids?: number[];
    representative_questions?: string[];
    top_questions?: Array<{ question?: string; count?: number }>;
    is_burst?: boolean;
    near_teacher_mark?: string | null;
    growth_rate?: number;
    volume_signal?: number;
    growth_signal?: number;
    student_diversity_signal?: number;
    burst_score?: number;
    burst_reasons?: string[];
    teacher_question?: TeacherQuestionItem | null;
    teacher_anchor_id?: string | null;
    teacher_anchor_question?: string | null;
    teacher_anchor_score?: number | null;
    teacher_anchor_confidence?: string | null;
    teacher_anchor_match_type?: string | null;
    teacher_anchor_reason?: string[];
    trigger_delay_seconds?: number | null;
    theme_distribution?: Record<string, number>;
    question_type_distribution?: Record<string, number>;
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
