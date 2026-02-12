import React from "react";
import { Navigate, useParams } from "react-router-dom";

const LegacyEditRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/admin/articles/editor/new" replace />;
  return <Navigate to={`/admin/articles/editor/${id}`} replace />;
};

export default LegacyEditRedirect;

