import React from "react";
import { createRoot, Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { FloatingPopup } from "./FloatingPopup";

jest.mock("antd", () => {
  return {
    Button: ({ children, onClick, onPointerDown }: any) => (
      <button type="button" onClick={onClick} onPointerDown={onPointerDown}>
        {children}
      </button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Typography: {
      Text: ({ children, style }: any) => <span style={style}>{children}</span>,
    },
  };
});

jest.mock("@ant-design/icons", () => ({
  CloseOutlined: () => null,
}));

describe("FloatingPopup", () => {
  const mountPopup = (props?: { draggable?: boolean; resizable?: boolean }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    flushSync(() => {
      root.render(
        <FloatingPopup
          open
          title="测试弹窗"
          onClose={() => {}}
          initialSize={{ w: 320, h: 240 }}
          draggable={props?.draggable}
          resizable={props?.resizable}
        >
          <div>内容</div>
        </FloatingPopup>
      );
    });
    return {
      host,
      root,
      unmount: () => {
        flushSync(() => {
          root.unmount();
        });
        host.remove();
      },
    };
  };

  test("默认渲染为可拖拽并显示缩放手柄", () => {
    const mounted = mountPopup();
    const { host } = mounted;
    const popup = host.querySelector("[data-testid='floating-popup']") as HTMLDivElement;
    const header = host.querySelector("[data-testid='floating-popup-header']") as HTMLDivElement;
    const handle = host.querySelector("[data-testid='floating-popup-resize-handle']") as HTMLDivElement;
    expect(popup).toBeTruthy();
    expect(header).toBeTruthy();
    expect(handle).toBeTruthy();
    expect(header.style.cursor).toBe("move");
    mounted.unmount();
  });

  test("关闭拖拽和缩放时隐藏对应能力", () => {
    const mounted = mountPopup({ draggable: false, resizable: false });
    const { host } = mounted;
    const header = host.querySelector("[data-testid='floating-popup-header']") as HTMLDivElement;
    const handle = host.querySelector("[data-testid='floating-popup-resize-handle']");
    expect(header.style.cursor).toBe("default");
    expect(handle).toBeNull();
    mounted.unmount();
  });
});
