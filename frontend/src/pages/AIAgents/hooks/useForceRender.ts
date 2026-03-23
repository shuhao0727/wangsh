/**
 * useForceRender - 强制浏览器立即渲染更新
 * 通过 requestAnimationFrame + 强制回流确保每次状态更新都真正显示
 */
import { useCallback } from 'react';

export function useForceRender() {
  const forceRender = useCallback((callback: () => void) => {
    return new Promise<void>((resolve) => {
      // 1. 执行状态更新
      callback();

      // 2. 使用 rAF 确保在下一帧渲染
      requestAnimationFrame(() => {
        // 3. 强制回流，确保浏览器真正渲染
        void document.body.offsetHeight;

        // 4. 再等一帧确保渲染完成
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }, []);

  return forceRender;
}
