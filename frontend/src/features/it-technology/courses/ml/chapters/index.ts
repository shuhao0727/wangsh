// Chapter markdown content — imported as raw strings via Vite
import computer_visionMd from "@/features/it-technology/courses/ml/chapters/computer-vision.md?raw";
import data_cleaningMd from "@/features/it-technology/courses/ml/chapters/data-cleaning.md?raw";
import deep_learningMd from "@/features/it-technology/courses/ml/chapters/deep-learning.md?raw";
import ensemble_learningMd from "@/features/it-technology/courses/ml/chapters/ensemble-learning.md?raw";
import feature_engineeringMd from "@/features/it-technology/courses/ml/chapters/feature-engineering.md?raw";
import math_foundationsMd from "@/features/it-technology/courses/ml/chapters/math-foundations.md?raw";
import mlopsMd from "@/features/it-technology/courses/ml/chapters/mlops.md?raw";
import model_evaluationMd from "@/features/it-technology/courses/ml/chapters/model-evaluation.md?raw";
import nlpMd from "@/features/it-technology/courses/ml/chapters/nlp.md?raw";
import overviewMd from "@/features/it-technology/courses/ml/chapters/overview.md?raw";
import portfolioMd from "@/features/it-technology/courses/ml/chapters/portfolio.md?raw";
import python_data_stackMd from "@/features/it-technology/courses/ml/chapters/python-data-stack.md?raw";
import ragMd from "@/features/it-technology/courses/ml/chapters/rag.md?raw";
import recommendation_systemsMd from "@/features/it-technology/courses/ml/chapters/recommendation-systems.md?raw";
import supervised_learningMd from "@/features/it-technology/courses/ml/chapters/supervised-learning.md?raw";
import unsupervised_learningMd from "@/features/it-technology/courses/ml/chapters/unsupervised-learning.md?raw";

/** Map from chapter slug to markdown content */
export const chapterMarkdown: Record<string, string> = {
  "computer-vision": computer_visionMd,
  "data-cleaning": data_cleaningMd,
  "deep-learning": deep_learningMd,
  "ensemble-learning": ensemble_learningMd,
  "feature-engineering": feature_engineeringMd,
  "math-foundations": math_foundationsMd,
  "mlops": mlopsMd,
  "model-evaluation": model_evaluationMd,
  "nlp": nlpMd,
  "overview": overviewMd,
  "portfolio": portfolioMd,
  "python-data-stack": python_data_stackMd,
  "rag": ragMd,
  "recommendation-systems": recommendation_systemsMd,
  "supervised-learning": supervised_learningMd,
  "unsupervised-learning": unsupervised_learningMd,
};