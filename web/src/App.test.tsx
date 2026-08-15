import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from './App';

afterEach(cleanup);

describe('App 三栏工作台 (M3)', () => {
  it('渲染侧边栏（会话/自选/导航）', () => {
    render(<App />);
    expect(screen.getByText('SESSIONS')).toBeInTheDocument();
    expect(screen.getByText('WATCHLIST')).toBeInTheDocument();
    expect(screen.getByText('Agent Panel')).toBeInTheDocument();
  });

  it('渲染中间详情面板与右侧 Agent 面板', () => {
    render(<App />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入问题，Enter 发送')).toBeInTheDocument();
    // 默认 Overview 与持仓卡
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('POSITION')).toBeInTheDocument();
  });
});
