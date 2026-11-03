import React from "react";
import PrivacyConsentPanel from "@/components/PrivacyConsentPanel";

const PrivacyPage: React.FC = () => (
  <div className="mx-auto max-w-3xl px-6 py-8">
    <h1 className="text-xl font-semibold">隐私与同意</h1>
    <p className="mt-2 text-sm text-text-secondary">
      管理平台对你个人数据的处理同意。不同意不会影响基本浏览，但相关 AI 功能可能不可用。
    </p>
    <div className="mt-6">
      <PrivacyConsentPanel />
    </div>
  </div>
);

export default PrivacyPage;