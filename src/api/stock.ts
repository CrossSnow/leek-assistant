import Taro from '@tarojs/taro';
import { StockDailyData, StockItem } from '../types/stock';

// 通用工具：ArrayBuffer(GBK编码) 转为 UTF-8 中文字符串
const gbkBufferToUtf8 = (buffer: ArrayBuffer): string => {
  const uint8Arr = new Uint8Array(buffer);
  return new TextDecoder('gbk').decode(uint8Arr);
};

/**
 * 获取单只基金/股票实时行情，计算当日预测盈亏
 * @param code 标的代码
 * @param holdShare 用户持有份额
 */
export const getFundDailyInfo = async (code: string, holdShare: number): Promise<StockDailyData & { loadError: boolean }> => {
  // 股票正则：60沪市 / 00深市主板 / 30创业板 / 688科创板
  // const isStockCode = /^(60|00|30|688)/.test(code);
  const isStockCode = /^(60|30|688)/.test(code);
  if (!isStockCode) {
    // 基金接口：天天基金估值 https 接口（UTF-8 无需转码）
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

  // ========== A股股票：腾讯财经接口（GBK编码，二进制缓冲解码） ==========
  const marketPrefix = code.startsWith('6') ? 'sh' : 'sz';
  const stockCode = marketPrefix + code;
  try {
    const res = await Taro.request({
      url: `https://qt.gtimg.cn/q=${stockCode}`,
      method: "GET",
      timeout: 10000,
      responseType: 'arraybuffer' // 关键：获取原始二进制，解决GBK乱码
    });
    // GBK二进制转UTF8字符串
    const text = gbkBufferToUtf8(res.data);
    const match = text.match(/"(.*?)"/);
    if (!match?.[1]) throw new Error('股票无行情');
    const arr = match[1].split('~');
    const stockName = arr[1];
    const yesterdayClose = Number(arr[4]); // 昨日收盘价
    const nowPrice = Number(arr[3]); // 当前现价
    const risePercent = Number(arr[32]); // 直接使用接口返回涨跌幅，避免浮点计算误差
    const todayPredictProfit = holdShare * (nowPrice - yesterdayClose);
    const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";
    // 格式化更新时间 20260707161431 → 2026-07-07 16:14
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
 * 混合搜索：公募基金 + A股股票，解决手机真机GBK中文乱码、自动去重
 * @param keyword 代码/名称搜索词
 */
export const searchStock = async (keyword: string): Promise<StockItem[]> => {
  try {
    const trimKey = keyword.trim();
    if (!trimKey) return [];
    const encodeKey = encodeURIComponent(trimKey);
    const list: StockItem[] = [];

    // 1. 东方财富基金搜索接口（GBK编码，二进制缓冲解码）
    const fundRes = await Taro.request({
      url: `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeKey}`,
      method: 'GET',
      timeout: 4000,
    });
    const resData = fundRes.data;
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

    // 2. 新浪股票搜索接口（GBK编码，二进制缓冲解码）
    const stockRes = await Taro.request({
      url: `https://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
      method: 'GET',
      timeout: 4000,
      responseType: 'arraybuffer'
    });
    const stockText = gbkBufferToUtf8(stockRes.data);
    const recordArr = stockText.split(';').filter(item => item.trim());
    for (const record of recordArr) {
      const fields = record.split(',');
      const code = fields[2] || '';
      const name = fields[4] || '';
      const tag = '股票';
      if (!code || !name) continue;
      // 去重：避免基金、股票代码重复
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
