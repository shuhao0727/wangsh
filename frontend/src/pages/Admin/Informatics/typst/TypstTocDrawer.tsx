import React from "react";
import { Button, Drawer, Typography } from "antd";

const { Text } = Typography;

type Props = {
  open: boolean;
  toc: any[];
  onClose: () => void;
  onJump: (it: any) => void;
};

export default function TypstTocDrawer({ open, toc, onClose, onJump }: Props) {
  return (
    <Drawer title="目录" open={open} onClose={onClose} placement="right" size="default">
      {toc?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {toc.map((it: any, idx: number) => (
            <div key={idx} style={{ paddingLeft: Math.max(0, (it.level || 1) - 1) * 12 }}>
              <Button type="link" style={{ padding: 0, height: "auto" }} onClick={() => onJump(it)}>
                {it.text}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary">暂无目录（可能没有 heading 或未成功编译）</Text>
      )}
    </Drawer>
  );
}

