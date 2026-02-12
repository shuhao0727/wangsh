import React from "react";
import GroupDiscussionAdminTab from "../AgentData/components/GroupDiscussion";
import { AdminPage } from "@components/Admin";

const AdminGroupDiscussionPage: React.FC = () => {
  return (
    <AdminPage>
      <GroupDiscussionAdminTab />
    </AdminPage>
  );
};

export default AdminGroupDiscussionPage;
