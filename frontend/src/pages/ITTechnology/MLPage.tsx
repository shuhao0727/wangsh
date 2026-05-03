import React from "react";
import AdminMLPage from "../Admin/ITTechnology/ml";

const MLPage: React.FC = () => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-[var(--ws-space-3)] py-[var(--ws-space-4)] md:px-[var(--ws-space-4)]">
      <AdminMLPage embedded />
    </div>
  );
};

export default MLPage;
