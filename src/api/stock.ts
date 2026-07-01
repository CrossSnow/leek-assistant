import Taro from '@tarojs/taro';
import { StockDailyData, StockItem } from '../types/stock';

/**
 * 获取单只基金实时净值、涨跌幅，根据持仓份额计算真实预测盈亏
 * @param code 基金6位代码
 * @param holdShare 用户持有份额
 * 接口返回示例：jsonpgz({"fundcode":"010595","name":"广发成长精选混合A","jzrq":"2026-06-30","dwjz":"0.7134","gsz":"0.7214","gszzl":"1.13","gztime":"2026-07-01 15:00"});
 */
export const getStockDailyInfo = async (code: string, holdShare: number): Promise<StockDailyData> => {
  try {
    const res = await Taro.request({
      url: `http://fundgz.1234567.com.cn/js/${code}.js`,
      method: "GET",
      timeout: 10000
    });
    const text = res.data as string;
    // 正则提取括号内JSON字符串
    const jsonStr = text.match(/jsonpgz\((.*?)\);/)?.[1];
    if (!jsonStr) {
      throw new Error('未获取到基金数据');
    }
    const data = JSON.parse(jsonStr);

    // 提取接口真实字段
    const risePercent = Number(data.gszzl);
    const nowNet = Number(data.gsz);
    const lastNet = Number(data.dwjz);
    // 真实盈亏 = 持有份额 * (当前净值 - 昨日净值)
    const todayPredictProfit = holdShare * (nowNet - lastNet);
    const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";

    return {
      code: data.fundcode,
      name: data.name,
      nowPrice: nowNet,
      yesterdayClose: lastNet,
      risePercent: risePercent,
      todayPredictProfit,
      predictDesc
    };
  } catch (err) {
    Taro.showToast({ title: '获取基金行情失败', icon: 'none' });
    // 异常兜底返回完整结构，页面不崩溃
    return {
      code,
      name: "未知基金",
      nowPrice: 0,
      yesterdayClose: 0,
      risePercent: 0,
      todayPredictProfit: 0,
      predictDesc: "暂无预测数据"
    };
  }
};

/**
 * 基金模糊搜索（新浪基金搜索接口）
 * @param keyword 基金代码/名称关键词
 */
export const searchStock = async (keyword: string): Promise<StockItem[]> => {
  try {
    const encodeKey = encodeURIComponent(keyword.trim());
    const res = await Taro.request({
      url: `http://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
      method: 'GET',
      timeout: 5000
    });
    const text = res.data as string;
    const list: StockItem[] = [];
    const reg = /(\d{6}),([^,]+)/g;
    let match: RegExpExecArray | null;
    while ((match = reg.exec(text)) !== null) {
      list.push({
        code: match[1],
        name: match[2],
        holdShare: 0 // 搜索结果默认份额0，弹窗手动输入
      });
    }
    return list;
  } catch (err) {
    Taro.showToast({ title: '搜索超时，网络不佳', icon: 'none' });
    return [];
  }
};
