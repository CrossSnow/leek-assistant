import Taro from '@tarojs/taro';
import { StockItem } from '../types/stock';

const KEY = 'leek_collect_list';
// 收益历史存储key
const PROFIT_HISTORY_KEY = 'leek_profit_history';

// 每日收益记录类型
export type ProfitRecord = {
  date: string; // 格式 YYYY-MM-DD
  profit: number; // 当日总盈亏金额
};

// 获取自选列表
export const getCollectList = (): StockItem[] => {
  const str = Taro.getStorageSync(KEY);
  return str ? JSON.parse(str) : [];
};

// 保存自选列表
export const setCollectList = (list: StockItem[]) => {
  Taro.setStorageSync(KEY, JSON.stringify(list));
};

// 添加自选（携带持仓份额）
export const addCollect = (stock: StockItem) => {
  const list = getCollectList();
  const has = list.find(item => item.code === stock.code);
  if (!has) {
    setCollectList([...list, stock]);
  } else {
    // 已存在则更新持仓份额
    const newList = list.map(item => {
      if (item.code === stock.code) return stock;
      return item;
    });
    setCollectList(newList);
  }
};

// 删除自选
export const delCollect = (code: string) => {
  const list = getCollectList().filter(item => item.code !== code);
  setCollectList(list);
};

// 清空全部自选
export const clearAllCollect = () => {
  Taro.removeStorageSync(KEY);
  // 清空自选同步清空收益历史
  Taro.removeStorageSync(PROFIT_HISTORY_KEY);
};

// ========== 新增：每日收益历史相关方法 ==========
// 获取收益历史
export const getProfitHistory = (): ProfitRecord[] => {
  const str = Taro.getStorageSync(PROFIT_HISTORY_KEY);
  return str ? JSON.parse(str) : [];
};

// 保存当日总盈亏，同一天覆盖，最多保留15条记录
export const saveTodayProfit = (todayTotalProfit: number) => {
  const history = getProfitHistory();
  const now = new Date();
  // 拼接标准日期 YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDate = `${year}-${month}-${day}`;

  // 判断今日是否已有记录，有则更新金额
  const targetIndex = history.findIndex(row => row.date === todayDate);
  if (targetIndex > -1) {
    history[targetIndex].profit = todayTotalProfit;
  } else {
    history.push({
      date: todayDate,
      profit: todayTotalProfit
    });
  }
  console.log(1234)
  console.log(history)

  // 仅保留最近15条，截断最早数据
  const limitHistory = history.slice(-15);
  Taro.setStorageSync(PROFIT_HISTORY_KEY, JSON.stringify(limitHistory));
};
