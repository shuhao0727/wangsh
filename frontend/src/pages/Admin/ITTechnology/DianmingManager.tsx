import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { dianmingApi, DianmingClass } from '@/services/xxjs/dianming';

interface Props {
}

const DianmingManager: React.FC<Props> = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DianmingClass[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DianmingClass | null>(null);
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
      if (editingRecord) {
        // 编辑模式：调用更新接口（覆盖名单）
        await dianmingApi.updateClassStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        message.success('更新成功');
      } else {
        // 新建模式：调用导入接口（追加名单）
        await dianmingApi.importStudents({
          year: values.year,
          class_name: values.class_name,
          names_text: values.names_text,
        });
        message.success('导入成功');
      }
      
      setIsModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error(editingRecord ? '更新失败' : '导入失败');
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

  const handleEdit = async (record: DianmingClass) => {
    setEditingRecord(record);
    try {
      const students = await dianmingApi.listStudents(record.year, record.class_name);
      const namesText = students.map(s => s.student_name).join('\n');
      
      form.setFieldsValue({
        year: record.year,
        class_name: record.class_name,
        names_text: namesText,
      });
      setIsModalVisible(true);
    } catch (error) {
      message.error('获取学生名单失败');
    }
  };

  const columns = [
    {
      title: '年份/届别',
      dataIndex: 'year',
      key: 'year',
      width: 120,
      ellipsis: true as const,
    },
    {
      title: '班级名称',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 180,
      ellipsis: true as const,
    },
    {
      title: '学生人数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: DianmingClass) => (
        <Space>
          <Button 
            type="primary" 
            ghost 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
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
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>班级点名数据管理</span>
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => {
            setEditingRecord(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
        >
          新建/导入班级
        </Button>
      </div>

      <Table
        loading={loading}
        dataSource={data}
        columns={columns}
        size="middle"
        rowKey={(record) => `${record.year}-${record.class_name}`}
      />

      <Modal
        title={editingRecord ? "编辑班级名单" : "新建/导入班级"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleImport} layout="vertical">
          <Form.Item
            name="year"
            label="年份/届别"
            rules={[{ required: true, message: '请输入年份，如 2024级' }]}
          >
            <Input placeholder="例如：2024级" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item
            name="class_name"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="例如：软件工程1班" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item
            name="names_text"
            label={editingRecord ? "学生名单 (修改后将覆盖原名单，一行一个姓名)" : "学生名单 (直接粘贴，一行一个姓名)"}
            rules={[{ required: true, message: '请输入学生名单' }]}
          >
            <Input.TextArea rows={15} placeholder="张三&#10;李四&#10;王五" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DianmingManager;
