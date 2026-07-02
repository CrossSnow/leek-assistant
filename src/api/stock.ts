import Taro from '@tarojs/taro';
import { StockDailyData, StockItem } from '../types/stock';

/**
 * 获取单只基金实时净值、涨跌幅，根据持仓份额计算真实预测盈亏
 * @param code 基金6位代码
 * @param holdShare 用户持有份额
 * 接口返回示例：jsonpgz({"fundcode":"010595","name":"广发成长精选混合A","jzrq":"2026-06-30","dwjz":"0.7134","gsz":"0.7214","gszzl":"1.13","gztime":"2026-07-01 15:00"});
 */
export const getFundDailyInfo = async (code: string, holdShare: number): Promise<StockDailyData & { loadError: boolean }> => {
  try {
    const res = await Taro.request({
      url: `http://fundgz.1234567.com.cn/js/${code}.js`,
      method: "GET",
      timeout: 10000
    });
    const text = res.data as string;
    // 正则提取 jsonpgz(xxx) 内部JSON
    const matchResult = text.match(/jsonpgz\((.*?)\);/);
    if (!matchResult?.[1]) {
      throw new Error('无估值数据');
    }
    const jsonStr = matchResult[1];
    const data = JSON.parse(jsonStr);

    // 安全转数字，空值兜底0
    const risePercent = Number(data.gszzl || 0);
    const nowNet = Number(data.gsz || 0);
    const lastNet = Number(data.dwjz || 0);
    // 当日预测盈亏 = 份额 * (实时估值 - 昨日净值)
    const todayPredictProfit = holdShare * (nowNet - lastNet);
    const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";

    return {
      code: data.fundcode,
      name: data.name,
      nowPrice: nowNet,
      yesterdayClose: lastNet,
      risePercent: risePercent,
      todayPredictProfit,
      predictDesc,
      loadError: false // 请求成功标记
    };
  } catch (err) {
    console.error('基金行情请求失败：', err);
    // 异常返回完整结构，带上错误标记
    return {
      code,
      name: "未知基金",
      nowPrice: 0,
      yesterdayClose: 0,
      risePercent: 0,
      todayPredictProfit: 0,
      predictDesc: "暂无估值数据，下拉刷新重试",
      loadError: true // 页面识别异常卡片
    };
  }
};


/**
 * 基金模糊搜索（新浪基金搜索接口）
 * @param keyword 基金代码/名称关键词
 */
export const searchStock = async (keyword: string): Promise<StockItem[]> => {
  try {
    const trimKey = keyword.trim();
    if (!trimKey) return [];
    const encodeKey = encodeURIComponent(trimKey);
    const res = await Taro.request({
      url: `http://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
      method: 'GET',
      timeout: 5000
    });
    const text = res.data as string;
    const list: StockItem[] = [];

    // 1. 按分号分割每条股票记录，过滤空末尾项
    const recordArr = text.split(';').filter(item => item.trim());

    for (const record of recordArr) {
      // 逗号拆分所有字段
      const fields = record.split(',');
      // 字段下标对应：
      // 0:sz001248 1:11 2:纯数字代码 3:sz001248 4:股票名称 9:ESG标签
      const code = fields[2] || '';
      const name = fields[4] || '';
      const tag = fields[9] || '';

      if (!code || !name) continue;

      list.push({
        code,
        name,
        tag: tag || undefined,
        holdShare: 0,
      });
    }

    return list;
  } catch (err) {
    Taro.showToast({ title: '搜索超时，网络不佳', icon: 'none' });
    return [];
  }
};
