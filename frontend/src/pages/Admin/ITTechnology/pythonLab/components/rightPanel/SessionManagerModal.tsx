import React, { useEffect, useRef, useState } from "react";
import { Button, Modal, Table } from "antd";
import { pythonlabSessionApi, type PythonLabSessionMeta } from "../../services/pythonlabSessionApi";

export function SessionManagerModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;

  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessions, setSessions] = useState<PythonLabSessionMeta[]>([]);
  const sessionsRefreshInFlightRef = useRef(false);
  const sessionsLastRefreshAtRef = useRef(0);

  const refreshSessions = async () => {
    if (sessionsRefreshInFlightRef.current) return;
    const now = Date.now();
    if (now - sessionsLastRefreshAtRef.current < 1200) return;
    sessionsRefreshInFlightRef.current = true;
    sessionsLastRefreshAtRef.current = now;
    setSessionsLoading(true);
    try {
      const resp = await pythonlabSessionApi.list();
      setSessions(resp.items || []);
    } catch {
    } finally {
      setSessionsLoading(false);
      sessionsRefreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshSessions();
  }, [open]);

  return (
    <Modal title="会话管理" open={open} onCancel={onClose} footer={null} width={700}>
      <Table
        dataSource={sessions}
        loading={sessionsLoading}
        rowKey="session_id"
        columns={[
          { title: "ID", dataIndex: "session_id", width: 200, ellipsis: true },
          { title: "状态", dataIndex: "status", width: 100 },
          { title: "端口", dataIndex: "dap_port", width: 100 },
          {
            title: "操作",
            render: (_, r) => (
              <Button
                danger
                size="small"
                onClick={async () => {
                  await pythonlabSessionApi.stop(r.session_id);
                  refreshSessions();
                }}
              >
                停止
              </Button>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Button onClick={refreshSessions} style={{ marginRight: 8 }}>
          刷新
        </Button>
        <Button
          danger
          onClick={async () => {
            await pythonlabSessionApi.cleanup();
            refreshSessions();
          }}
        >
          一键清理所有
        </Button>
      </div>
    </Modal>
  );
}

