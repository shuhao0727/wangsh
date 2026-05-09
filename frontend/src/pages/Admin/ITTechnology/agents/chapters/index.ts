// Chapter markdown content — imported as raw strings via Vite
import agent_conceptMd from "./agent-concept.md?raw";
import enterprise_projectMd from "./enterprise-project.md?raw";
import evaluationMd from "./evaluation.md?raw";
import frameworksMd from "./frameworks.md?raw";
import function_callingMd from "./function-calling.md?raw";
import mcpMd from "./mcp.md?raw";
import memoryMd from "./memory.md?raw";
import multi_agentMd from "./multi-agent.md?raw";
import observabilityMd from "./observability.md?raw";
import planningMd from "./planning.md?raw";
import productionMd from "./production.md?raw";
import rag_agentMd from "./rag-agent.md?raw";
import react_patternMd from "./react-pattern.md?raw";
import securityMd from "./security.md?raw";
import tool_useMd from "./tool-use.md?raw";

/** Map from chapter slug to markdown content */
export const chapterMarkdown: Record<string, string> = {
  "agent-concept": agent_conceptMd,
  "enterprise-project": enterprise_projectMd,
  "evaluation": evaluationMd,
  "frameworks": frameworksMd,
  "function-calling": function_callingMd,
  "mcp": mcpMd,
  "memory": memoryMd,
  "multi-agent": multi_agentMd,
  "observability": observabilityMd,
  "planning": planningMd,
  "production": productionMd,
  "rag-agent": rag_agentMd,
  "react-pattern": react_patternMd,
  "security": securityMd,
  "tool-use": tool_useMd,
};