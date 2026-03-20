/**
 * 浮动按钮位置注册表
 * 集中管理所有浮动面板按钮的垂直位置，防止重叠
 */

interface BtnEntry {
  id: string;
  top: number;
  setTop: (v: number) => void;
}

const MIN_GAP = 6; // 最小间距 6%

class FloatingBtnRegistry {
  private entries = new Map<string, BtnEntry>();

  register(id: string, top: number, setTop: (v: number) => void) {
    this.entries.set(id, { id, top, setTop });
  }

  unregister(id: string) {
    this.entries.delete(id);
  }

  updateTop(id: string, top: number) {
    const entry = this.entries.get(id);
    if (entry) entry.top = top;
  }

  /**
   * 拖拽结束时调用：锚定被拖拽按钮，将其他按钮推开
   *
   * 策略：以被拖拽按钮为锚点，上方的按钮从锚点向上依次排开，
   * 下方的按钮从锚点向下依次排开。
   */
  settle(draggedId: string) {
    const all = Array.from(this.entries.values());
    if (all.length <= 1) return;

    // 按当前 top 排序
    const sorted = all.map(e => ({ id: e.id, top: e.top }));
    sorted.sort((a, b) => a.top - b.top);

    const anchorIdx = sorted.findIndex(p => p.id === draggedId);
    if (anchorIdx < 0) return;

    const anchorTop = sorted[anchorIdx].top;

    // 从锚点向下推：锚点右边的按钮，每个至少比前一个大 MIN_GAP
    let prev = anchorTop;
    for (let i = anchorIdx + 1; i < sorted.length; i++) {
      if (sorted[i].top - prev < MIN_GAP) {
        sorted[i].top = Math.min(90, prev + MIN_GAP);
      }
      prev = sorted[i].top;
    }

    // 从锚点向上推：锚点左边的按钮，每个至少比后一个小 MIN_GAP
    let next = anchorTop;
    for (let i = anchorIdx - 1; i >= 0; i--) {
      if (next - sorted[i].top < MIN_GAP) {
        sorted[i].top = Math.max(0, next - MIN_GAP);
      }
      next = sorted[i].top;
    }

    // 应用变更到非拖拽按钮
    for (const pos of sorted) {
      if (pos.id === draggedId) continue;
      const entry = this.entries.get(pos.id);
      if (entry && Math.abs(entry.top - pos.top) > 0.1) {
        entry.top = pos.top;
        entry.setTop(pos.top);
      }
    }
  }
}

export const floatingBtnRegistry = new FloatingBtnRegistry();
