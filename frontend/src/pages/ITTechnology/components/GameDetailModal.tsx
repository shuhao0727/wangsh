/**
 * GameDetailModal — 游戏详情弹窗
 * 展示游戏信息，提供下载入口（需登录）
 */

import React, { useEffect, useState } from "react";
import {
  Download,
  ShieldAlert,
  HardDrive,
  Calendar,
  Tag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useAuth from "@hooks/useAuth";
import { useITGameDownload } from "@hooks/queries/useITGamesQuery";
import { gamesApi } from "@services/it/games";
import type { GameResource } from "@services/it/games";

interface Props {
  open: boolean;
  onClose: () => void;
  game: GameResource | null;
}

/** 格式化文件大小 */
const fmtSize = (bytes: number): string => {
  if (bytes === 0) return "未知";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const GameDetailModal: React.FC<Props> = ({ open, onClose, game }) => {
  const auth = useAuth();
  const downloadGame = useITGameDownload();

  // 本地态：保存最新游戏详情，初始值随 prop 同步
  // prop game 由父组件控制，子组件不能直接改，故用 localState 镜像
  const [localGame, setLocalGame] = useState<GameResource | null>(game);

  // prop game 变化时（如打开新游戏）同步到本地态
  useEffect(() => {
    setLocalGame(game);
  }, [game]);

  if (!localGame) return null;

  const isLoggedIn = auth.isLoggedIn?.() ?? false;

  const handleDownload = async () => {
    if (!isLoggedIn) {
      // 跳转到登录页
      window.location.href = "/login";
      return;
    }
    try {
      const blob = await downloadGame.mutateAsync(localGame.id);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = localGame.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      // 下载成功后重新获取详情，刷新下载计数
      try {
        const latest = await gamesApi.get(localGame.id);
        setLocalGame(latest);
      } catch (err) {
        // 详情刷新失败不影响已成功的下载，静默处理
        console.warn("刷新游戏详情失败：", err);
      }
    } catch {
      alert("下载失败，请确认已登录并有下载权限");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{localGame.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {localGame.description || "暂无简介"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* 分类标签 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              <Tag className="h-3 w-3" />
              {localGame.category}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
              <HardDrive className="h-3 w-3" />
              {fmtSize(localGame.file_size)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
              <Download className="h-3 w-3" />
              {localGame.download_count} 次下载
            </span>
          </div>

          {/* 文件信息 */}
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <Calendar className="mb-1 h-3 w-3 text-text-tertiary" />
            <p className="text-xs text-text-tertiary">
              文件名：{localGame.filename}
            </p>
            {localGame.file_sha256 && (
              <p className="mt-1 text-xs text-text-tertiary break-all">
                SHA256：{localGame.file_sha256}
              </p>
            )}
            {localGame.created_at && (
              <p className="mt-1 text-xs text-text-tertiary">
                上传时间：{new Date(localGame.created_at).toLocaleDateString("zh-CN")}
              </p>
            )}
          </div>

          {/* 未登录提示 */}
          {!isLoggedIn && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="text-xs text-text-base">
                <p className="font-medium">下载需要登录</p>
                <p className="mt-0.5">请先登录账号后再下载游戏文件。</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownload}
            disabled={downloadGame.isPending}
          >
            {downloadGame.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            {isLoggedIn ? "下载" : "去登录"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
