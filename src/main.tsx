import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './fonts.css';
// 避免双重挂载导致验证界面出现两次资源创建；资源释放由各模块生命周期负责。
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
