// Chapter markdown content — imported as raw strings via Vite
import agent_conceptMd from "@/features/it-technology/courses/agents/chapters/agent-concept.md?raw";
import enterprise_projectMd from "@/features/it-technology/courses/agents/chapters/enterprise-project.md?raw";
import evaluationMd from "@/features/it-technology/courses/agents/chapters/evaluation.md?raw";
import frameworksMd from "@/features/it-technology/courses/agents/chapters/frameworks.md?raw";
import function_callingMd from "@/features/it-technology/courses/agents/chapters/function-calling.md?raw";
import mcpMd from "@/features/it-technology/courses/agents/chapters/mcp.md?raw";
import memoryMd from "@/features/it-technology/courses/agents/chapters/memory.md?raw";
import multi_agentMd from "@/features/it-technology/courses/agents/chapters/multi-agent.md?raw";
import observabilityMd from "@/features/it-technology/courses/agents/chapters/observability.md?raw";
import planningMd from "@/features/it-technology/courses/agents/chapters/planning.md?raw";
import productionMd from "@/features/it-technology/courses/agents/chapters/production.md?raw";
import rag_agentMd from "@/features/it-technology/courses/agents/chapters/rag-agent.md?raw";
import react_patternMd from "@/features/it-technology/courses/agents/chapters/react-pattern.md?raw";
import securityMd from "@/features/it-technology/courses/agents/chapters/security.md?raw";
import tool_useMd from "@/features/it-technology/courses/agents/chapters/tool-use.md?raw";

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