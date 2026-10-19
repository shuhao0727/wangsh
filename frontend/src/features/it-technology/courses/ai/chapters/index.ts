// Chapter markdown content — imported as raw strings via Vite
import symbolic_searchMd from "@/features/it-technology/courses/ai/chapters/symbolic-search.md?raw";
import knowledge_representationMd from "@/features/it-technology/courses/ai/chapters/knowledge-representation.md?raw";
import expert_systemsMd from "@/features/it-technology/courses/ai/chapters/expert-systems.md?raw";
import supervised_learningMd from "@/features/it-technology/courses/ai/chapters/supervised-learning.md?raw";
import unsupervised_learningMd from "@/features/it-technology/courses/ai/chapters/unsupervised-learning.md?raw";
import reinforcement_learningMd from "@/features/it-technology/courses/ai/chapters/reinforcement-learning.md?raw";
import neural_networksMd from "@/features/it-technology/courses/ai/chapters/neural-networks.md?raw";
import cnn_visionMd from "@/features/it-technology/courses/ai/chapters/cnn-vision.md?raw";
import transformer_attentionMd from "@/features/it-technology/courses/ai/chapters/transformer-attention.md?raw";
import llm_pretrainingMd from "@/features/it-technology/courses/ai/chapters/llm-pretraining.md?raw";
import finetune_alignmentMd from "@/features/it-technology/courses/ai/chapters/finetune-alignment.md?raw";
import inference_deployMd from "@/features/it-technology/courses/ai/chapters/inference-deploy.md?raw";
import nlp_ragMd from "@/features/it-technology/courses/ai/chapters/nlp-rag.md?raw";
import computer_visionMd from "@/features/it-technology/courses/ai/chapters/computer-vision.md?raw";
import generative_ai_appsMd from "@/features/it-technology/courses/ai/chapters/generative-ai-apps.md?raw";
import ai_safetyMd from "@/features/it-technology/courses/ai/chapters/ai-safety.md?raw";
import ai_ethicsMd from "@/features/it-technology/courses/ai/chapters/ai-ethics.md?raw";
import ai_futureMd from "@/features/it-technology/courses/ai/chapters/ai-future.md?raw";

/** Map from chapter slug to markdown content */
export const chapterMarkdown: Record<string, string> = {
  "symbolic-search": symbolic_searchMd,
  "knowledge-representation": knowledge_representationMd,
  "expert-systems": expert_systemsMd,
  "supervised-learning": supervised_learningMd,
  "unsupervised-learning": unsupervised_learningMd,
  "reinforcement-learning": reinforcement_learningMd,
  "neural-networks": neural_networksMd,
  "cnn-vision": cnn_visionMd,
  "transformer-attention": transformer_attentionMd,
  "llm-pretraining": llm_pretrainingMd,
  "finetune-alignment": finetune_alignmentMd,
  "inference-deploy": inference_deployMd,
  "nlp-rag": nlp_ragMd,
  "computer-vision": computer_visionMd,
  "generative-ai-apps": generative_ai_appsMd,
  "ai-safety": ai_safetyMd,
  "ai-ethics": ai_ethicsMd,
  "ai-future": ai_futureMd,
};
