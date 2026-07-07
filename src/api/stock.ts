import Taro from '@tarojs/taro';
import { StockDailyData, StockItem } from '../types/stock';

/**
 * 获取单只基金实时净值、涨跌幅，根据持仓份额计算真实预测盈亏
 * @param code 基金6位代码
 * @param holdShare 用户持有份额
 * 接口返回示例：jsonpgz({"fundcode":"010595","name":"广发成长精选混合A","jzrq":"2026-06-30","dwjz":"0.7134","gsz":"0.7214","gszzl":"1.13","gztime":"2026-07-01 15:00"});
 */
export const getFundDailyInfo = async (code: string, holdShare: number): Promise<StockDailyData & { loadError: boolean }> => {
  // 判断是基金还是A股股票
  const isStock = /^(60|30|688)/.test(code);
  if (!isStock) {
    // 基金：原有天天基金接口
    try {
      const res = await Taro.request({
        url: `https://fundgz.1234567.com.cn/js/${code}.js`,
        method: "GET",
        timeout: 10000
      });
      const text = res.data as string;
      const matchResult = text.match(/jsonpgz\((.*?)\);/);
      if (!matchResult?.[1]) throw new Error('无估值数据');
      const jsonStr = matchResult[1];
      const data = JSON.parse(jsonStr);
      const risePercent = Number(data.gszzl || 0);
      const nowNet = Number(data.gsz || 0);
      const lastNet = Number(data.dwjz || 0);
      const todayPredictProfit = holdShare * (nowNet - lastNet);
      const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";
      const updateTime = data.gztime || '';
      return {
        code: data.fundcode,
        name: data.name,
        nowPrice: nowNet,
        yesterdayClose: lastNet,
        risePercent: risePercent,
        todayPredictProfit,
        predictDesc,
        updateTime,
        loadError: false
      };
    } catch (err) {
      console.error('基金行情请求失败：', err);
      return {
        code,
        name: "未知基金",
        nowPrice: 0,
        yesterdayClose: 0,
        risePercent: 0,
        todayPredictProfit: 0,
        predictDesc: "暂无估值数据，点击刷新重试",
        updateTime: '',
        loadError: true
      };
    }
  }

  // ========== 股票走腾讯财经接口 ==========
  let marketPrefix = code.startsWith('6') ? 'sh' : 'sz';
  const stockCode = marketPrefix + code;
  try {
    const res = await Taro.request({
      url: `https://qt.gtimg.cn/q=${stockCode}`,
      method: "GET",
      timeout: 10000
    });
    const text = res.data as string;
    // 正则提取引号内行情字符串
    const match = text.match(/"(.*?)"/);
    if (!match?.[1]) throw new Error('股票无行情');
    const arr = match[1].split('~');
    const stockName = arr[0];
    const yesterdayClose = Number(arr[4]); // 昨日收盘价
    const nowPrice = Number(arr[3]); // 当前现价
    const risePercent = ((nowPrice - yesterdayClose) / yesterdayClose) * 100;
    const todayPredictProfit = holdShare * (nowPrice - yesterdayClose);
    const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";
    // 股票无估值时间，用当前时分填充
    const rawTime = arr[30];
    let updateTime = '';
    if (rawTime && rawTime.length >= 12) {
      const year = rawTime.slice(0, 4);
      const month = rawTime.slice(4, 6);
      const day = rawTime.slice(6, 8);
      const hour = rawTime.slice(8, 10);
      const minute = rawTime.slice(10, 12);
      updateTime = `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return {
      code,
      name: stockName,
      nowPrice,
      yesterdayClose,
      risePercent: Number(risePercent.toFixed(2)),
      todayPredictProfit: Number(todayPredictProfit.toFixed(2)),
      predictDesc,
      updateTime,
      loadError: false
    };
  } catch (err) {
    console.error('股票行情请求失败：', err);
    return {
      code,
      name: "未知股票",
      nowPrice: 0,
      yesterdayClose: 0,
      risePercent: 0,
      todayPredictProfit: 0,
      predictDesc: "暂无行情数据，点击刷新重试",
      updateTime: '',
      loadError: true
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
      url: `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeKey}`,
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
      url: `https://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
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
