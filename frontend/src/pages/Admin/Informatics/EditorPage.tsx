import { showMessage } from "@/lib/toast";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
        const d = e?.response?.data?.detail;
        showMessage.error(typeof d === "string" ? d : (e?.message || "加载笔记失败"));
        navigate("/admin/informatics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isCreateMode, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
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
