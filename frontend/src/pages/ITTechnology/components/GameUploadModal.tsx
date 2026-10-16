/**
 * GameUploadModal — 管理员上传/编辑游戏弹窗
 * 支持上传游戏文件（安装包）+ 填写信息
 */

import React, { useRef, useState, useEffect } from "react";
import {
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showMessage } from "@/lib/toast";
import type { GameResource } from "@services/it/games";
import { useITGameMutations } from "@hooks/queries/useITGamesQuery";

const PRESET_CATEGORIES = ["益智", "动作", "冒险", "模拟", "策略", "竞速", "工具", "其它"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** 编辑模式：传入已有游戏进行编辑 */
  editRecord?: GameResource | null;
}

export const GameUploadModal: React.FC<Props> = ({ open, onClose, onSuccess, editRecord }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // 上架/下架状态：编辑模式下可切换，新建默认上架
  const [isActive, setIsActive] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { createGame, updateGame } = useITGameMutations();

  const isEdit = !!editRecord;

  useEffect(() => {
    if (open) {
      if (editRecord) {
        setTitle(editRecord.title);
        setDescription(editRecord.description || "");
        setCategory(editRecord.category);
        setFile(null);
        // 编辑模式：用记录中的 is_active 初始化，缺省视为上架
        setIsActive(editRecord.is_active ?? true);
      } else {
        setTitle("");
        setDescription("");
        setCategory("");
        setFile(null);
        // 新建模式：默认上架
        setIsActive(true);
      }
    }
  }, [open, editRecord]);

  const handleSave = async () => {
    if (!title.trim()) { showMessage.warning("请输入游戏名称"); return; }
    if (!category) { showMessage.warning("请选择分类"); return; }
    if (!isEdit && !file) { showMessage.warning("请选择要上传的游戏文件"); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateGame.mutateAsync({
          id: editRecord!.id,
          data: {
            title: title.trim(),
            description: description.trim() || undefined,
            category,
            is_active: isActive,
          },
        });
        showMessage.success("信息已更新");
      } else {
        const fd = new FormData();
        fd.append("title", title.trim());
        fd.append("category", category);
        if (description.trim()) fd.append("description", description.trim());
        fd.append("file", file!);
        await createGame.mutateAsync(fd);
        showMessage.success("上传成功");
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "操作失败";
      showMessage.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑游戏信息" : "上传游戏"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "修改已有游戏的基本信息" : "上传游戏安装包并填写信息"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* 游戏名称 */}
          <div>
            <Label htmlFor="g-title" className="ws-modal-label">游戏名称</Label>
            <Input
              id="g-title"
              className="mt-1 h-8 text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入游戏名称"
            />
          </div>

          {/* 分类 */}
          <div>
            <Label className="ws-modal-label">分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 上架/下架开关（仅编辑模式显示，新建默认上架） */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border bg-surface-2 px-3 py-2">
              <div className="flex flex-col">
                <Label htmlFor="g-active" className="ws-modal-label">
                  {isActive ? "已上架" : "已下架"}
                </Label>
                <span className="text-xs text-text-tertiary">
                  {isActive ? "前台可见，用户可下载" : "下架后前台不可见，仅管理员可见"}
                </span>
              </div>
              <Switch
                id="g-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}

          {/* 简介 */}
          <div>
            <Label htmlFor="g-desc" className="ws-modal-label">简介（选填）</Label>
            <Textarea
              id="g-desc"
              className="mt-1 h-8 min-h-16 text-xs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述游戏内容"
            />
          </div>

          {/* 文件上传（仅新建） */}
          {!isEdit && (
            <div>
              <Label className="ws-modal-label">游戏文件</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
              {!file ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full h-10 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  选择文件
                </Button>
              ) : (
                <div className="mt-1 flex items-center justify-between rounded-lg border bg-surface-2 px-3 py-2">
                  <span className="text-xs text-text truncate mr-2">{file.name}（{Math.round(file.size / 1024 / 1024 * 10) / 10} MB）</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleFileRemove}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "保存" : "上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
