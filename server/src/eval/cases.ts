export interface EvalCase {
  id: string;
  message: string;
  context?: { symbol?: string; name?: string };
  /** 期望调用的工具（验证工具选择正确性） */
  expectTool?: string;
  /** 回答必须包含的正则（免责声明等） */
  mustInclude?: RegExp[];
  /** 回答不应包含的正则（如"仅支持美股"等退化信号） */
  expectNot?: RegExp[];
}

/** 评测用例集：覆盖行情/财务/K线/新闻 + 工具选择 + 回归（美股 bug） */
export const EVAL_CASES: EvalCase[] = [
  {
    id: 'quote-600519',
    message: '贵州茅台现在多少钱？',
    context: { symbol: '600519', name: '贵州茅台' },
    expectTool: 'get_quote',
    mustInclude: [/不构成投资建议/],
    expectNot: [/仅支持美股|美股/],
  },
  {
    id: 'financials-000001',
    message: '平安银行（000001）的 PE 是多少？',
    context: { symbol: '000001', name: '平安银行' },
    expectTool: 'get_financials',
  },
  {
    id: 'kline-300750',
    message: '宁德时代最近几天走势怎么样？',
    context: { symbol: '300750', name: '宁德时代' },
    expectTool: 'get_kline',
  },
  {
    id: 'news-600519',
    message: '贵州茅台最近有什么新闻？',
    context: { symbol: '600519', name: '贵州茅台' },
    expectTool: 'get_news',
  },
  {
    id: 'a-share-only',
    message: '茅台是 A 股还是美股？',
    // 只拦截"仅支持美股/不支持A股"式拒绝，不拦"不是美股"这种正常回答
    expectNot: [/仅支持美股|只支持美股|不支持A股|无法查询A股|美股数据/],
  },
];
