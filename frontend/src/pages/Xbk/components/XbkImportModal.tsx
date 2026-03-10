import React, { useState, useEffect, useCallback } from "react";
import { Modal, Upload, Button, Select, Checkbox, Alert, Space, Card, Table, message } from "antd";
import { UploadOutlined, DownloadOutlined } from "@ant-design/icons";
import { xbkDataApi } from "@services";
import type { XbkScope, XbkImportPreview, XbkImportResult } from "@services";

const { Option } = Select;

interface XbkImportModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  filters: {
    year?: number;
    term?: "上学期" | "下学期";
    grade?: "高一" | "高二";
  };
}

export const XbkImportModal: React.FC<XbkImportModalProps> = ({ open, onCancel, onSuccess, filters }) => {
  const [importScope, setImportScope] = useState<XbkScope>("students");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<XbkImportPreview | null>(null);
  const [importResult, setImportResult] = useState<XbkImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<"高一" | "高二" | undefined>(filters.grade);

  useEffect(() => {
    if (open) {
      setSelectedGrade(filters.grade);
      setImportFile(null);
      setPreview(null);
      setImportResult(null);
    }
  }, [open, filters.grade]);

  const getErrorMsg = (e: any, defaultMsg: string) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => err.msg).join("; ");
    }
    if (typeof detail === "object") {
      return JSON.stringify(detail);
    }
    return detail || defaultMsg;
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await xbkDataApi.downloadTemplate({ scope: importScope, grade: selectedGrade });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xbk_${importScope}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      message.error(getErrorMsg(e, "下载模板失败（需要管理员登录）"));
    }
  };

  const runPreview = useCallback(async (file: File) => {
    setPreviewLoading(true);
    try {
      const res = await xbkDataApi.previewImport({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: selectedGrade,
        file,
      });
      setPreview(res);
      setImportResult(null);
    } catch (e: any) {
      setPreview(null);
      setImportResult(null);
      message.error(getErrorMsg(e, "预检失败（需要管理员登录）"));
    } finally {
      setPreviewLoading(false);
    }
  }, [filters.year, filters.term, selectedGrade, importScope]);

  useEffect(() => {
    if (open && importFile) {
      runPreview(importFile);
    }
  }, [importFile, open, runPreview]);

  const handleImport = async () => {
    if (!importFile) {
      message.warning("请选择要导入的 Excel 文件");
      return;
    }
    setImporting(true);
    try {
      const res = await xbkDataApi.importData({
        scope: importScope,
        year: filters.year,
        term: filters.term,
        grade: selectedGrade,
        skip_invalid: skipInvalid,
        file: importFile,
      });
      setImportResult(res);
      message.success(
        `导入完成：处理 ${res.processed} 行（新增 ${res.inserted}，更新 ${res.updated}，无效 ${res.invalid}）`,
      );
      onSuccess();
    } catch (e: any) {
      message.error(getErrorMsg(e, "导入失败（需要管理员登录）"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title="导入数据"
      open={open}
      confirmLoading={importing}
      onCancel={onCancel}
      onOk={handleImport}
      okText="导入"
      width={700}
      okButtonProps={{
        disabled: !importFile || previewLoading || (preview ? preview.valid_rows === 0 : false),
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <span>导入类型:</span>
          <Select value={importScope} style={{ width: 140 }} onChange={setImportScope}>
            <Option value="students">学生名单</Option>
            <Option value="courses">选课目录</Option>
            <Option value="selections">选课结果</Option>
          </Select>
          <span style={{ marginLeft: 16 }}>所属年级:</span>
          <Select
            value={selectedGrade}
            style={{ width: 100 }}
            placeholder="选择年级"
            allowClear
            onChange={setSelectedGrade}
          >
            <Option value="高一">高一</Option>
            <Option value="高二">高二</Option>
          </Select>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ marginLeft: 8 }}>
            下载模板
          </Button>
        </Space>

        <Space>
          <Upload
            maxCount={1}
            beforeUpload={(file) => {
              setImportFile(file);
              return false;
            }}
            onRemove={() => {
              setImportFile(null);
              setPreview(null);
              setImportResult(null);
            }}
            fileList={importFile ? [importFile as any] : []}
          >
            <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
          </Upload>
          <Checkbox checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)}>
            跳过错误行并继续导入
          </Checkbox>
        </Space>

        {previewLoading && <Alert message="正在预检文件…" type="info" showIcon />}

        {preview && (
          <Alert
            type={preview.invalid_rows > 0 ? "warning" : "success"}
            showIcon
            message={`共 ${preview.total_rows} 行：可导入 ${preview.valid_rows} 行，错误 ${preview.invalid_rows} 行`}
            description={
              preview.invalid_rows > 0 ? (
                <div>
                  {preview.errors.slice(0, 5).map((e) => (
                    <div key={e.row}>
                      第 {e.row} 行：{e.errors.join("；")}
                    </div>
                  ))}
                  {preview.errors.length > 5 && <div>…更多错误请修正后重新预检</div>}
                </div>
              ) : (
                "预检通过，可以导入"
              )
            }
          />
        )}

        {preview?.preview?.length && (
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey={(_, idx) => String(idx)}
              size="small"
              pagination={false}
              columns={(preview.columns || []).slice(0, 12).map((c) => ({
                title: c,
                dataIndex: c,
                ellipsis: true,
              }))}
              dataSource={preview.preview}
              scroll={{ x: "max-content" }}
            />
          </Card>
        )}

        {importResult && (
          <Alert
            type="success"
            showIcon
            message={`导入完成：处理 ${importResult.processed} 行（新增 ${importResult.inserted}，更新 ${importResult.updated}，无效 ${importResult.invalid}）`}
          />
        )}

        <div style={{ color: "var(--ws-color-text-secondary)", fontSize: "var(--ws-text-sm)" }}>
          <p>• 会优先使用你当前筛选的 年份/学期/年级 作为默认值（Excel里也可包含“年份/学期/年级”列）。</p>
          <p>• 字段要求：学生名单（年份、学期、年级、班级、学号、姓名、性别）｜选课目录（年份、学期、年级、课程代码、课程名称、课程负责人、限报人数、上课地点）｜选课结果（年份、学期、年级、学号、姓名、课程代码）</p>
        </div>
      </Space>
    </Modal>
  );
};
