import React from "react";
import AdminAgentsPage from "../Admin/ITTechnology/agents";

const AgentsPage: React.FC = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      <AdminAgentsPage embedded />
    </div>
  );
};

export default AgentsPage;
