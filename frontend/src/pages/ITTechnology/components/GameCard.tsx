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
      className="group flex min-h-[calc(var(--ws-space-unit)*26)] w-full items-start gap-3 border-0 border-b border-[var(--ws-color-border-secondary)] px-2 py-3 text-left transition-colors hover:bg-[var(--ws-color-workspace-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
          color,
        }}
      >
        <MonitorPlay className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-base">{game.title}</h3>
          <span className="shrink-0 text-xs font-medium" style={{ color }}>{game.category}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {game.description || "暂无简介"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {fmtSize(game.file_size)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" />
            {game.download_count}
          </span>
        </div>
      </div>
    </button>
  );
};
