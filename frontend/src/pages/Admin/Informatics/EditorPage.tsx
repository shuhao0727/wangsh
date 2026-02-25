import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spin, message } from "antd";
import TypstNoteEditor from "./TypstNoteEditor";
import { typstNotesApi } from "@services";
import type { TypstNote } from "@services";

const AdminTypstEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreateMode = id === undefined;

  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<TypstNote | null>(null);
  const noteRef = useRef<TypstNote | null>(null);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    const load = async () => {
      if (isCreateMode) {
        setLoading(false);
        setNote(null);
        return;
      }
      if (!id) return;
      const numericId = Number(id);
      const current = noteRef.current;
      if (!current || current.id !== numericId) setLoading(true);
      try {
        const n = await typstNotesApi.get(numericId);
        setNote(n);
      } catch (e: any) {
        message.error(e?.response?.data?.detail || e?.message || "加载笔记失败");
        navigate("/admin/informatics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isCreateMode, navigate]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <TypstNoteEditor
      note={note}
      isCreateMode={isCreateMode}
      onCreated={(created) => {
        setNote(created);
        setLoading(false);
        navigate(`/admin/informatics/editor/${created.id}`, { replace: true });
      }}
      onBack={() => navigate("/admin/informatics")}
    />
  );
};

export default AdminTypstEditorPage;
