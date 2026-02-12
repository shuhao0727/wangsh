import React from 'react';
import { Typography, Card } from 'antd';
import { LaptopOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ITTechnologyPage: React.FC = () => {
  return (
    <div>
      <Card>
        <Title level={2}><LaptopOutlined /> 信息技术</Title>
        <Text>信息技术功能模块 - 开发中</Text>
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'var(--ws-color-surface-2)', borderRadius: '8px' }}>
          <Text strong>功能规划：</Text>
          <ul>
            <li>编程技术分享</li>
            <li>系统架构设计</li>
            <li>开发工具介绍</li>
            <li>技术趋势分析</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ITTechnologyPage;
