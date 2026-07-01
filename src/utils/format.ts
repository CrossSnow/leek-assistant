// 涨跌颜色标记
export const getRiseClass = (percent: number) => percent >= 0 ? 'rise' : 'fall';

// 补正负号
export const formatPercent = (num: number) => {
  const n = num.toFixed(2);
  return num >= 0 ? `+${n}%` : `${n}%`;
};

// 预测盈亏格式化
export const formatProfit = (profit: number) => {
  return profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
};
