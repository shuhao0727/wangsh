import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Spin, Typography, message, Space } from 'antd';
import { dianmingApi, DianmingClass, DianmingStudent } from '@/services/xxjs/dianming';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Props {
  record: DianmingClass;
  onBack: () => void;
}

const RollCallPlayer: React.FC<Props> = ({ record, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<DianmingStudent[]>([]);
  const [currentName, setCurrentName] = useState<string>('准备就绪');
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await dianmingApi.listStudents(record.year, record.class_name);
        setStudents(res);
        if (res.length > 0) {
          setCurrentName('点击开始');
        } else {
          setCurrentName('暂无学生');
        }
      } catch (error) {
        message.error('获取学生名单失败');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
    return () => stopAnimation();
  }, [record]);

  const startAnimation = () => {
    if (students.length === 0) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * students.length);
      setCurrentName(students[randomIndex].student_name);
    }, 50); // 50ms 快速切换
  };

  const stopAnimation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    // 最终确定一个名字 (也可以在动画中确定，这里简单起见)
    if (students.length > 0) {
      const randomIndex = Math.floor(Math.random() * students.length);
      setCurrentName(students[randomIndex].student_name);
      // 可选：播放音效或高亮
    }
  };

  const toggle = () => {
    if (isRunning) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#001529',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}
    >
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <Button onClick={onBack} ghost>
          返回管理
        </Button>
      </div>
      
      <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 16, opacity: 0.8 }}>
        {record.year} - {record.class_name} ({students.length}人)
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <Spin size="large" />
        ) : (
          <Title
            level={1}
            style={{
              color: '#fff',
              fontSize: isRunning ? '8vw' : '12vw',
              margin: 0,
              fontWeight: 'bold',
              textShadow: '0 0 20px rgba(255,255,255,0.5)',
              transition: 'all 0.1s',
            }}
          >
            {currentName}
          </Title>
        )}
      </div>

      <div style={{ paddingBottom: 100 }}>
        <Space size="large">
          <Button
            type="primary"
            shape="round"
            size="large"
            icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
            style={{
              height: 80,
              width: 200,
              fontSize: 24,
              backgroundColor: isRunning ? '#ff4d4f' : '#1890ff',
              borderColor: isRunning ? '#ff4d4f' : '#1890ff',
            }}
            onClick={toggle}
            disabled={students.length === 0}
          >
            {isRunning ? '停止' : '开始点名'}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default RollCallPlayer;
