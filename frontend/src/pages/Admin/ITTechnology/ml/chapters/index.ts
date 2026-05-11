// Chapter markdown content — imported as raw strings via Vite
import computer_visionMd from "./computer-vision.md?raw";
import data_cleaningMd from "./data-cleaning.md?raw";
import deep_learningMd from "./deep-learning.md?raw";
import ensemble_learningMd from "./ensemble-learning.md?raw";
import feature_engineeringMd from "./feature-engineering.md?raw";
import math_foundationsMd from "./math-foundations.md?raw";
import mlopsMd from "./mlops.md?raw";
import model_evaluationMd from "./model-evaluation.md?raw";
import nlpMd from "./nlp.md?raw";
import overviewMd from "./overview.md?raw";
import portfolioMd from "./portfolio.md?raw";
import python_data_stackMd from "./python-data-stack.md?raw";
import ragMd from "./rag.md?raw";
import recommendation_systemsMd from "./recommendation-systems.md?raw";
import supervised_learningMd from "./supervised-learning.md?raw";
import unsupervised_learningMd from "./unsupervised-learning.md?raw";

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