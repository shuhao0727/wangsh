export type NavVisibilityItem = {
  id: string;
  label: string;
  path: string;
  flagKey: string;
  showOnHome: boolean;
};

export const NAV_VISIBILITY_ITEMS: NavVisibilityItem[] = [
  { id: "ai-agents", label: "AI智能体", path: "/ai-agents", flagKey: "ai_agents_nav_enabled", showOnHome: true },
  { id: "informatics", label: "信息学竞赛", path: "/informatics", flagKey: "informatics_competition_nav_enabled", showOnHome: true },
  { id: "it-technology", label: "信息技术", path: "/it-technology", flagKey: "it_technology_nav_enabled", showOnHome: true },
  { id: "personal-programs", label: "个人程序", path: "/personal-programs", flagKey: "personal_programs_nav_enabled", showOnHome: true },
  { id: "articles", label: "文章", path: "/articles", flagKey: "articles_nav_enabled", showOnHome: true },
];
