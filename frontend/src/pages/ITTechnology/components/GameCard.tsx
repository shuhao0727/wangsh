/**
 * GameCard — 游戏资源卡片
 * 用于游戏资源库网格列表，点击打开详情弹窗
 */

import React from "react";
import { Download, HardDrive, MonitorPlay } from "lucide-react";
import type { GameResource } from "@services/it/games";

interface Props {
  game: GameResource;
  onSelect: (game: GameResource) => void;
}

const fmtSize = (bytes: number): string => {
  if (bytes === 0) return "未知";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const CATEGORY_COLORS: Record<string, string> = {
  "益智": "var(--ws-color-warning)",
  "动作": "var(--ws-color-error)",
  "冒险": "var(--ws-color-purple)",
  "模拟": "var(--ws-color-info)",
  "策略": "var(--ws-color-success)",
  "竞速": "var(--ws-color-warning)",
  "工具": "var(--ws-color-primary)",
  "其它": "var(--ws-color-text-tertiary)",
};

const fallbackColor = "var(--ws-color-text-tertiary)";

export const GameCard: React.FC<Props> = ({ game, onSelect }) => {
  const color = CATEGORY_COLORS[game.category] || fallbackColor;

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      className="w-full text-left rounded-xl border border-border bg-surface p-5
        hover:border-[var(--ws-color-primary)]/30 hover:shadow-sm transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* 图标区 */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
          color,
        }}
      >
        <MonitorPlay className="h-7 w-7" />
      </div>

      {/* 标题 + 分类 */}
      <h3 className="font-semibold text-text-base truncate">{game.title}</h3>
      <p className="text-xs text-text-tertiary mt-1 line-clamp-2 min-h-[2lh]">
        {game.description || "暂无简介"}
      </p>

      {/* 分类标签 */}
      <div className="mt-3 flex items-center gap-3 text-xs text-text-tertiary">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`,
            color,
          }}
        >
          {game.category}
        </span>
        <span className="inline-flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          {fmtSize(game.file_size)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Download className="h-3 w-3" />
          {game.download_count}
        </span>
      </div>
    </button>
  );
};
