import { test, expect } from '@playwright/test';

test.describe('股票 Agent 工作台 E2E（A 股）', () => {
  test('三栏渲染 + 默认茅台详情 + 2×2 卡片 + Tab 切换', async ({ page }) => {
    await page.goto('/');

    // 左：三区
    await expect(page.getByText('SESSIONS')).toBeVisible();
    await expect(page.getByText('WATCHLIST')).toBeVisible();
    await expect(page.getByText('Agent Panel')).toBeVisible();

    // 默认 600519，详情头部显示真实中文名（等待实时数据）
    await expect(page.locator('h1')).toContainText('贵州茅台', { timeout: 20_000 });

    // 头部指标
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Prev Close', { exact: true }).first()).toBeVisible();

    // Overview 2×2 卡片 + 持仓卡
    for (const t of ['QUOTE', 'PERFORMANCE', 'VALUATION', 'BASIC FUNDAMENTALS', 'POSITION']) {
      await expect(page.getByText(t, { exact: true })).toBeVisible();
    }

    // 切 Chart → 出现 canvas K 线图
    await page.getByText('Chart', { exact: true }).click();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  });

  test('选中自选联动详情 + 未配置模型时发送消息出提示', async ({ page }) => {
    await page.goto('/');

    // 切到平安银行
    await page.getByText('000001', { exact: true }).click();
    await expect(page.locator('h1')).toContainText('平安银行', { timeout: 20_000 });

    // 发消息：未配置模型 → 出现引导提示
    await page.getByPlaceholder('输入问题，Enter 发送').fill('贵州茅台现在多少钱');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/配置模型 API/)).toBeVisible({ timeout: 10_000 });
  });
});
