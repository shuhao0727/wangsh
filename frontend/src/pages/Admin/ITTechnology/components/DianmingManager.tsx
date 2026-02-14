import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';

interface Props {
  onStartRollCall: (record: DianmingClass) => void;
  onBack: () => void;
}

const DianmingManager: React.FC<Props> = ({ onStartRollCall, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DianmingClass[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dianmingApi.listClasses();
      setData(res);
    } catch (error) {
      message.error('获取班级列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImport = async (values: any) => {
    try {
      await dianmingApi.importStudents({
        year: values.year,
        class_name: values.class_name,
        names_text: values.names_text,
      });
      message.success('导入成功');
      setIsModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('导入失败');
    }
  };

  const handleDelete = async (record: DianmingClass) => {
    try {
      await dianmingApi.deleteClass(record.year, record.class_name);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '年份/届别',
      dataIndex: 'year',
      key: 'year',
      width: 150,
    },
    {
      title: '班级名称',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 200,
    },
    {
      title: '学生人数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DianmingClass) => (
        <Space>
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />} 
            onClick={() => onStartRollCall(record)}
          >
            开始点名
          </Button>
          <Popconfirm
            title="确定要删除该班级及其所有学生吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#fff' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button onClick={onBack}>返回应用列表</Button>
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>班级点名管理</span>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          新建/导入班级
        </Button>
      </div>

      <Table
        loading={loading}
        dataSource={data}
        columns={columns}
        rowKey={(record) => `${record.year}-${record.class_name}`}
      />

      <Modal
        title="新建/导入班级"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleImport} layout="vertical">
          <Form.Item
            name="year"
            label="年份/届别"
            rules={[{ required: true, message: '请输入年份，如 2024级' }]}
          >
            <Input placeholder="例如：2024级" />
          </Form.Item>
          <Form.Item
            name="class_name"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="例如：软件工程1班" />
          </Form.Item>
          <Form.Item
            name="names_text"
            label="学生名单 (直接粘贴，一行一个姓名)"
            rules={[{ required: true, message: '请输入学生名单' }]}
          >
            <Input.TextArea rows={10} placeholder="张三&#10;李四&#10;王五" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DianmingManager;
