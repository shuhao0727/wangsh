import React from "react";
import AgentsLearningPage from "@/features/it-technology/courses/agents/LearningPage";

const AgentsPage: React.FC = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      <AgentsLearningPage embedded />
    </div>
  );
};

export default AgentsPage;
