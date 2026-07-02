// 本地存储的自选股票基础信息
export interface StockItem {
  code: string; // 基金代码
  name: string; // 基金名称
  tag?: string; // ESG标签
  holdShare: number; //持仓份额
}

// 接口返回的实时行情+预测收益数据
export interface StockDailyData {
  code: string;
  name: string;
  nowPrice: number; // 当前估算净值
  yesterdayClose: number; // 昨收净值
  risePercent: number; // 涨跌幅
  todayPredictProfit: number; // 当日预测盈亏（根据份额实时计算）
  predictDesc: string; // 预测描述（看涨/看跌）
}
