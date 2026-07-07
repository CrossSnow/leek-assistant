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
    // 提取估值更新时间 gztime
    const updateTime = data.gztime || '';

    return {
      code: data.fundcode,
      name: data.name,
      nowPrice: nowNet,
      yesterdayClose: lastNet,
      risePercent: risePercent,
      todayPredictProfit,
      predictDesc,
      updateTime, // 新增估值更新时间
      loadError: false // 请求成功标记
    };
  } catch (err) {
    console.error('基金行情请求失败：', err);
    // 异常返回完整结构，带上错误标记，updateTime兜底空字符串
    return {
      code,
      name: "未知基金",
      nowPrice: 0,
      yesterdayClose: 0,
      risePercent: 0,
      todayPredictProfit: 0,
      predictDesc: "暂无估值数据，下拉刷新重试",
      updateTime: '', // 异常兜底空
      loadError: true // 页面识别异常卡片
    };
  }
};


/**
 * 搜索：股票 + 公募基金 混合搜索
 * @param keyword 代码/名称
 */
export const searchStock = async (keyword: string): Promise<StockItem[]> => {
  try {
    const trimKey = keyword.trim();
    if (!trimKey) return [];
    const encodeKey = encodeURIComponent(trimKey);
    const list: StockItem[] = [];

    // 1. 请求东方财富基金搜索接口
    const fundRes = await Taro.request({
      url: `http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeKey}`,
      method: 'GET',
      timeout: 4000
    });
    const resData = fundRes.data;
    // 判断接口正常且有基金列表
    if (resData.ErrCode === 0 && Array.isArray(resData.Datas)) {
      resData.Datas.forEach((item: any) => {
        const code = item.CODE || '';
        const name = item.NAME || '';
        const tag = item.CATEGORYDESC || '基金';
        if (!code || !name) return;
        list.push({
          code,
          name,
          tag,
          holdShare: 0,
        });
      });
    }

    // 2. 原有新浪股票搜索（保留，兼容股票）
    const stockRes = await Taro.request({
      url: `http://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
      method: 'GET',
      timeout: 4000
    });
    const text = stockRes.data as string;
    const recordArr = text.split(';').filter(item => item.trim());
    for (const record of recordArr) {
      const fields = record.split(',');
      console.log(fields[9])
      console.log(fields);
      const code = fields[2] || '';
      const name = fields[4] || '';
      const tag = '股票';
      if (!code || !name) continue;
      // 去重：基金已存在则不重复添加
      const isExist = list.some(i => i.code === code);
      if (!isExist) {
        list.push({ code, name, tag, holdShare: 0 });
      }
    }

    return list;
  } catch (err) {
    console.error('搜索异常：', err);
    Taro.showToast({ title: '搜索超时，网络不佳', icon: 'none' });
    return [];
  }
};
