import React, { useState, useEffect, useRef } from 'react';
import { Button, Spin, message } from 'antd';
import { dianmingApi, DianmingClass, DianmingStudent } from '@/services/xxjs/dianming';
import { PlayCircleOutlined, StopOutlined, ArrowLeftOutlined } from '@ant-design/icons';

interface Props {
  record: DianmingClass;
  onBack: () => void;
}

const RollCallPlayer: React.FC<Props> = ({ record, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<DianmingStudent[]>([]);
  const [currentName, setCurrentName] = useState<string>('准备就绪');
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      } catch (_error) {
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
    // 最终确定一个名字
    if (students.length > 0) {
      const randomIndex = Math.floor(Math.random() * students.length);
      setCurrentName(students[randomIndex].student_name);
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
    <div className="it-player-container">
      <div className="it-player-header">
        <Button onClick={onBack} ghost icon={<ArrowLeftOutlined />}>
          返回选择
        </Button>
        <div className="it-player-info">
          {record.year}级 {record.class_name} · 共{students.length}人
        </div>
      </div>

      <div className="it-player-main">
        {loading ? (
          <Spin size="large" />
        ) : (
          <div style={{ textAlign: 'center' }}>
             <h1 
               className="it-player-name" 
               style={{ 
                 fontSize: isRunning ? 'min(15vw, 120px)' : 'min(20vw, 180px)',
                 opacity: isRunning ? 0.8 : 1
               }}
             >
               {currentName}
             </h1>
             {!isRunning && students.length > 0 && currentName !== '点击开始' && (
               <div className="mt-6 text-2xl opacity-60 text-primary-hover">
                 🎉 幸运儿诞生
               </div>
             )}
          </div>
        )}
      </div>

      <div className="it-player-controls">
        <Button
          type="primary"
          className={`it-player-btn ${isRunning ? 'it-player-btn-stop' : 'it-player-btn-start'}`}
          icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
          onClick={toggle}
          disabled={students.length === 0}
        >
          {isRunning ? '停止' : '开始点名'}
        </Button>
      </div>
    </div>
  );
};

export default RollCallPlayer;
