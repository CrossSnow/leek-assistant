import Taro from '@tarojs/taro';
import { StockItem } from '../types/stock';

const KEY = 'leek_collect_list';

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
};
