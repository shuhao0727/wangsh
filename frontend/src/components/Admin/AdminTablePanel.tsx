import React from "react";
import { Empty, Spin } from "antd";

type Props = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
};

const AdminTablePanel: React.FC<Props> = ({
  title, extra, loading = false, isEmpty = false,
  emptyDescription, emptyAction, children, pagination,
}) => (
  <div className="flex flex-col h-full overflow-hidden">
    {(title || extra) && (
      <div className="flex items-center justify-between px-6 py-3">
        {title && <div className="text-base font-semibold">{title}</div>}
        {extra && <div>{extra}</div>}
      </div>
    )}

    <div className="flex-1 overflow-hidden flex flex-col">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spin size="large" />
        </div>
      ) : isEmpty ? (
        <div className="flex items-center justify-center h-full">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
            {emptyAction}
          </Empty>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}
    </div>

    {pagination && (
      <div className="flex justify-end px-6 py-3 border-t border-black/[0.04]">
        {pagination}
      </div>
    )}
  </div>
);

export default AdminTablePanel;
