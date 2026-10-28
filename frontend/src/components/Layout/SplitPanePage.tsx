import React from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number;
  gap?: number;
  alignItems?: "start" | "stretch";
  className?: string;
  style?: React.CSSProperties;
};

const SplitPanePage: React.FC<Props> = ({ left, right, leftWidth = 420, gap = 18, alignItems = "start", className, style }) => {
  const screens = useBreakpoint();
  // 窄屏（< md）时改为上下堆叠
  const isStacked = !screens.md;

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: isStacked ? "minmax(0, 1fr)" : `${leftWidth}px minmax(0, 1fr)`,
        // 堆叠模式必须声明两行：只有一行时第二个子元素会落到隐式行，
        // 第一行被 minmax(0, 1fr) 压成 0px，导致左侧面板（如文章目录）完全不可见。
        gridTemplateRows: isStacked ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
        gap: isStacked ? 12 : gap,
        alignItems,
        width: "100%",
        height: "100%",
        minHeight: 0,
        flex: 1,
        ...style,
      }}
    >
      {/* 堆叠模式下左侧限高 40vh 并自行滚动，避免长目录把正文挤出视口。
          alignSelf:"start" 是关键：网格默认 stretch 会把子项高度强行拉满并压缩内容，
          导致 maxHeight 只夹住盒子、内部目录仍被压扁而不产生滚动。改为 start 后
          子项按内容自然撑高、到 40vh 被夹住，overflowY:auto 才会真实产生滚动条。
          桌面端（isStacked=false）保持原有 100% 高度行为完全不变。 */}
      <div
        style={
          isStacked
            ? {
                minWidth: 0,
                minHeight: 0,
                maxHeight: "40vh",
                overflowY: "auto",
                alignSelf: "start",
              }
            : { minWidth: 0, minHeight: 0, height: "100%" }
        }
      >
        {left}
      </div>
      <div style={{ minWidth: 0, minHeight: 0, height: "100%" }}>{right}</div>
    </div>
  );
};

export default SplitPanePage;
