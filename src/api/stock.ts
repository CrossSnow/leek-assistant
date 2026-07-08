import Taro from '@tarojs/taro';
import { StockDailyData, StockItem } from '../types/stock';
import { getCollectList } from '../utils/storage';

/**
 * 获取单只基金/股票实时行情，计算当日预测盈亏
 * @param code 标的代码
 * @param holdShare 用户持有份额
 */
export const getFundDailyInfo = async (code: string, holdShare: number): Promise<StockDailyData & { loadError: boolean }> => {
  // 第一步：优先尝试天天基金估值接口（场外基金UTF8无乱码）
  try {
    const res = await Taro.request({
      url: `https://fundgz.1234567.com.cn/js/${code}.js`,
      method: "GET",
      timeout: 15000
    });
    const text = res.data as string;
    const matchResult = text.match(/jsonpgz\((.*?)\);/);
    if (matchResult?.[1]) {
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
    }
  } catch (err) {
    console.log('天天基金无数据，切换新浪行情接口', code, err);
  }

  // ========== 降级：新浪 hq.sinajs.cn 行情接口 ==========
  const marketPrefix = code.startsWith('6') || code.startsWith('5') ? 'sh' : 'sz';
  const stockUrl = `https://hq.sinajs.cn/list=${marketPrefix}${code}`;
  try {
    const res = await Taro.request({
      url: stockUrl,
      method: "GET",
      timeout: 15000,
      header: {
        Referer: "https://finance.sina.com.cn/" // 必须加Referer防拦截
      }
    });
    const rawText = res.data as string;
    // 提取引号内核心数据
    const quoteMatch = rawText.match(/"(.*?)"/);
    if (!quoteMatch || !quoteMatch[1]) throw new Error('无行情数据');
    const fields = quoteMatch[1].split(',');

    // 核心数值
    const rawName = fields[0] || '';
    const yesterdayClose = Number(fields[2]);
    const nowPrice = Number(fields[3]);
    // 手动计算涨跌幅
    const risePercent = yesterdayClose === 0 ? 0 : ((nowPrice - yesterdayClose) / yesterdayClose) * 100;
    const todayPredictProfit = holdShare * (nowPrice - yesterdayClose);
    const predictDesc = risePercent >= 0 ? "短期看涨" : "短期承压看跌";

    // 时间格式化
    const dateStr = fields[30] || '';
    const timeStr = fields[31] || '';
    let updateTime = `${dateStr} ${timeStr}`;

    // 关键：优先读取本地自选缓存里正常中文名称，彻底解决GBK乱码
    const collectList = getCollectList();
    const localItem = collectList.find(item => item.code === code);
    const stockName = localItem?.name || rawName;

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
    console.error('双接口全部请求失败', err);
    return {
      code,
      name: "未知标的",
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
 * 混合搜索：公募基金 + A股股票（无内存缓存）
 */
export const searchStock = async (keyword: string): Promise<StockItem[]> => {
  const trimKey = keyword.trim();
  if (!trimKey) return [];
  const encodeKey = encodeURIComponent(trimKey);
  const list: StockItem[] = [];
  let retry = 0;
  const MAX_RETRY = 1;

  const requestFund = async () => {
    return Taro.request({
      url: `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeKey}`,
      method: 'GET',
      timeout: 15000
    });
  };
  const requestStock = async () => {
    return Taro.request({
      url: `https://suggest3.sinajs.cn/suggest/type=11&key=${encodeKey}`,
      method: 'GET',
      timeout: 15000
    });
  };

  try {
    let fundRes;
    try {
      fundRes = await requestFund();
    } catch (e) {
      if (retry < MAX_RETRY) {
        retry++;
        fundRes = await requestFund();
      } else throw e;
    }
    const resData = fundRes.data;
    if (resData.ErrCode === 0 && Array.isArray(resData.Datas)) {
      resData.Datas.forEach((item: any) => {
        const code = item.CODE || '';
        const name = item.NAME || '';
        const tag = item.CATEGORYDESC || '基金';
        if (!code || !name) return;
        list.push({ code, name, tag, holdShare: 0 });
      });
    }

    let stockRes;
    retry = 0;
    try {
      stockRes = await requestStock();
    } catch (e) {
      if (retry < MAX_RETRY) {
        retry++;
        stockRes = await requestStock();
      } else throw e;
    }
    const text = stockRes.data as string;
    const recordArr = text.split(';').filter(item => item.trim());
    for (const record of recordArr) {
      const fields = record.split(',');
      const code = fields[2] || '';
      const name = fields[4] || '';
      const tag = '股票';
      if (!code || !name) continue;
      const isExist = list.some(i => i.code === code);
      if (!isExist) {
        list.push({ code, name, tag, holdShare: 0 });
      }
    }
    return list;
  } catch (err) {
    console.error('搜索异常：', err);
    Taro.showToast({ title: '搜索超时，请切换网络重试', icon: 'none' });
    return [];
  }
};
