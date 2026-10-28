// 临时验证入口（S6-2，验证后删除）：只渲染 RadarChart。
import { createRoot } from "react-dom/client";
import RadarChart from "./RadarChart";

const root = createRoot(document.getElementById("app")!);
root.render(
  <div style={{ width: 320, height: 320 }}>
    <RadarChart dimensions={{ 甲: 80, 乙: 60, 丙: 40, 丁: 90 }} size={320} />
  </div>,
);
