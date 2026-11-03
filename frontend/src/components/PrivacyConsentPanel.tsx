import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import { privacyApi, type ConsentState, type ConsentType } from "@services/privacy";

const CONSENT_LABELS: Record<ConsentType, { title: string; description: string }> = {
  AI_USAGE: {
    title: "AI 对话与智能体服务",
    description: "允许平台处理我在 AI 智能体中的输入与输出，用于对话、分析和相关课堂功能。",
  },
  DATA_ANALYSIS: {
    title: "学习数据分析",
    description: "允许平台在课堂分析中使用我的提问记录。拒绝不影响基本浏览和学习功能。",
  },
};

const PrivacyConsentPanel: React.FC = () => {
  const [items, setItems] = useState<ConsentState[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await privacyApi.list();
      setItems(data);
      setDraft(Object.fromEntries(data.map((item) => [item.consent_type, item.consented === true])));
    } catch {
      setError("同意状态加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (consentType: ConsentType, consented: boolean) => {
    setBusy(consentType);
    setError("");
    try {
      const updated = consented
        ? await privacyApi.update(consentType, true)
        : await privacyApi.withdraw(consentType);
      setItems((current) => current.map((item) => item.consent_type === consentType ? updated : item));
      setDraft((current) => ({ ...current, [consentType]: updated.consented === true }));
      showMessage.success(consented ? "已记录同意" : "已撤回同意");
    } catch {
      setError("同意状态保存失败，请稍后重试。");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p role="status" className="text-sm text-text-secondary">正在加载同意状态…</p>;
  if (error) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void load()}>重试</Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-2 rounded-sm border border-border-secondary bg-surface px-4 py-3 text-sm text-text-secondary">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>这里只记录你的同意意愿，不会删除历史数据；撤回后新的数据处理将不再以该同意为依据。</p>
      </div>
      {items.map((item) => {
        const label = CONSENT_LABELS[item.consent_type];
        return (
          <div key={item.consent_type} className="rounded-sm border border-border-secondary p-4">
            <div className="flex items-start justify-between gap-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={draft[item.consent_type] === true}
                  disabled={busy !== null}
                  onChange={(event) => setDraft((current) => ({ ...current, [item.consent_type]: event.target.checked }))}
                />
                <span>
                  <span className="block font-medium text-text-base">{label.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">{label.description}</span>
                  <span className="mt-1 block text-xs text-text-tertiary">
                    当前：{item.consented === null ? "未记录" : item.consented ? "已同意" : "已撤回"}
                  </span>
                </span>
              </label>
              <Button
                size="sm"
                disabled={busy !== null || (item.consented !== null && (draft[item.consent_type] === true) === item.consented)}
                onClick={() => void save(item.consent_type, draft[item.consent_type] === true)}
              >
                {busy === item.consent_type ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default PrivacyConsentPanel;