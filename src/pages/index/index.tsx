import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Input, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { getCollectList, delCollect, addCollect, saveTodayProfit } from '../../utils/storage';
import { getFundDailyInfo } from '../../api/stock';
import { formatPercent, formatProfit, getRiseClass } from '../../utils/format';
import { StockDailyData, StockItem } from '../../types/stock';
import './index.scss';

type StockCombine = StockItem & StockDailyData & { loadError: boolean };
type FilterType = 'all' | '基金' | '股票';

const Index = () => {
  const [stockDataList, setStockDataList] = useState<StockCombine[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFund, setEditFund] = useState<StockCombine | null>(null);
  const [editShare, setEditShare] = useState('');
  const [showLongPressModal, setShowLongPressModal] = useState(false);
  const [currentOperateStock, setCurrentOperateStock] = useState<StockCombine | null>(null);
  // 手动刷新loading
  const [refreshLoading, setRefreshLoading] = useState(false);

   // 计算一组持仓总盈亏（过滤掉加载失败标的）
  const calcTotalProfit = (list: StockCombine[]) => {
    return list.reduce((sum, item) => {
      if (item.loadError) return sum;
      return sum + item.todayPredictProfit;
    }, 0);
  };

  const filterList = stockDataList.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === '基金') return item.tag === '基金';
    // 选中股票分类时，展示所有非基金标的
    return item.tag !== '基金';
  });

  // 计算当前筛选列表当日总盈亏（只算无加载错误的数据）
  const totalTodayProfit = calcTotalProfit(filterList);

  // 分批加载行情，控制并发5个，解决批量并发超时
const fetchAllByBatch = async (list: StockItem[], batchSize = 5) => {
  const result: StockCombine[] = [];
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    const batchData = await Promise.all(batch.map(item => getFundDailyInfo(item.code, item.holdShare)));
    batch.forEach((item, idx) => {
      result.push({ ...item, ...batchData[idx] });
    });
  }
  return result;
};

// 加载数据（纯数据逻辑）
const fetchAllStockInfoData = async () => {
  const collectList = getCollectList();
  if (collectList.length === 0) {
    setStockDataList([]);
    saveTodayProfit(0);
    return;
  }
  // 分批请求替代一次性Promise.all，根治批量并发超时
  const allResult = await fetchAllByBatch(collectList, 5);
  setStockDataList(allResult);
  const sum = allResult.reduce((s, item) => {
    if (item.loadError) return s;
    return s + item.todayPredictProfit;
  }, 0);
  saveTodayProfit(sum);
};

  // 手动点击刷新按钮
  const handleManualRefresh = async () => {
    if (refreshLoading) return;
    setRefreshLoading(true);
    try {
      await fetchAllStockInfoData();
      Taro.showToast({ title: '刷新完成', icon: 'none' });
    } catch (e) {
      console.error('刷新失败', e);
      Taro.showToast({ title: '刷新失败，请重试', icon: 'none' });
    } finally {
      setRefreshLoading(false);
    }
  };

  // 页面首次挂载加载一次数据
  useEffect(() => {
    fetchAllStockInfoData();
  }, []);

  // 【核心修复】每次从其他Tab切回本页面自动执行刷新
  useDidShow(() => {
    fetchAllStockInfoData();
  });

  // 删除自选
  const handleDel = (code: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定移除这条自选持仓吗？',
      success: (res) => {
        if (res.confirm) {
          delCollect(code);
          fetchAllStockInfoData();
        }
      }
    });
    setShowLongPressModal(false);
    setCurrentOperateStock(null);
  };

  // 修改份额弹窗
  const openEditShareModal = (stock: StockCombine) => {
    setEditFund(stock);
    setEditShare(String(stock.holdShare));
    setShowEditModal(true);
    setShowLongPressModal(false);
  };

  const confirmEditShare = () => {
    if (!editFund) return;
    const share = Number(editShare.trim());
    if (isNaN(share) || share <= 0 || !Number.isInteger(share)) {
      Taro.showToast({ title: '请输入正整数份额', icon: 'none' });
      return;
    }
    addCollect({ code: editFund.code, name: editFund.name, holdShare: share, tag: editFund.tag });
    setShowEditModal(false);
    Taro.showToast({ title: '份额修改成功' });
    fetchAllStockInfoData();
  };

  const handleLongPressCard = (stock: StockCombine) => {
    setCurrentOperateStock(stock);
    setShowLongPressModal(true);
  };

  return (
    <ScrollView
      className="page-index"
      scrollY
      style={{ height: '100vh' }}
    >
      <View className="scroll-wrap">
        {/* 筛选栏 + 右侧刷新按钮 */}
        <View className="filter-wrap">
          <View className="filter-tab">
            <Button
              size="mini"
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >全部</Button>
            <Button
              size="mini"
              className={`filter-btn ${activeFilter === '基金' ? 'active' : ''}`}
              onClick={() => setActiveFilter('基金')}
            >仅基金</Button>
            <Button
              size="mini"
              className={`filter-btn ${activeFilter === '股票' ? 'active' : ''}`}
              onClick={() => setActiveFilter('股票')}
            >仅股票</Button>
          </View>
          <Button
            size="mini"
            className="refresh-btn"
            onClick={handleManualRefresh}
            loading={refreshLoading}
          >
            刷新
          </Button>
        </View>

        {/* 左右布局：左侧提示文字，右侧当日总盈亏 */}
        <View className="tip-row">
          <Text className="tip-text">长按卡片可修改份额/删除</Text>
          <Text className={`total-profit ${totalTodayProfit >= 0 ? 'rise' : 'fall'}`}>
            当日合计：{formatProfit(totalTodayProfit)} 元
          </Text>
        </View>

        {filterList.length === 0 ? (
          <View className="empty">
            <Text>{stockDataList.length ? '当前筛选无持仓数据' : '暂无自选持仓'}</Text>
            <Button
              size="mini"
              type="primary"
              onClick={() => Taro.switchTab({ url: '/pages/search/index' })}
              className="empty-btn"
            >
              前往搜索添加持仓
            </Button>
          </View>
        ) : (
          filterList.map((stock) => (
            <View
              key={stock.code}
              className="stock-card"
              onLongPress={() => handleLongPressCard(stock)}
            >
              <View className="stock-head">
                <Text className="name">{stock.name || `未知标的(${stock.code})`}</Text>
                {!stock.loadError && (
                  <Text className={getRiseClass(stock.risePercent)}>
                    {formatPercent(stock.risePercent)}
                  </Text>
                )}
              </View>
              <Text className="stock-code">标的代码：{stock.code}</Text>

              {stock.loadError ? (
                <View className="error-tip">
                  <Text>行情数据获取异常，点击上方刷新重试</Text>
                </View>
              ) : (
                <>
                  <View className="stock-body">
                    <Text>实时净值：{stock.nowPrice.toFixed(4)}</Text>
                    <Text>持仓份额：{stock.holdShare}</Text>
                  </View>
                  <View className="stock-profit">
                    <Text className={stock.todayPredictProfit >= 0 ? 'rise' : 'fall'}>
                      当日预测盈亏：{formatProfit(stock.todayPredictProfit)} 元
                    </Text>
                  </View>
                  <Text className="predict-desc">趋势判断：{stock.predictDesc}</Text>
                  {stock.updateTime && (
                    <Text className="update-time">估值更新：{stock.updateTime}</Text>
                  )}
                  <View className={`card-badge ${stock.tag === '基金' ? 'badge-fund' : 'badge-stock'}`}>
                    {stock.tag || '未知'}
                  </View>
                </>
              )}
            </View>
          ))
        )}
      </View>

      {showLongPressModal && currentOperateStock && (
        <View className="modal-mask" onClick={() => setShowLongPressModal(false)}>
          <View className="operate-modal-box" onClick={(e) => e.stopPropagation()}>
            <Text className="operate-title">{currentOperateStock.name}</Text>
            <View className="operate-btn-group">
              <Button className="operate-btn edit" onClick={() => openEditShareModal(currentOperateStock)}>修改份额</Button>
              <Button className="operate-btn del" danger onClick={() => handleDel(currentOperateStock.code)}>删除自选</Button>
              <Button className="operate-btn cancel" onClick={() => setShowLongPressModal(false)}>取消</Button>
            </View>
          </View>
        </View>
      )}

      {showEditModal && editFund && (
        <View className="modal-mask" onClick={() => setShowEditModal(false)}>
          <View className="modal-box" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">修改 {editFund.name || editFund.code} 持仓份额</Text>
            <Input
              type="digit"
              value={editShare}
              onInput={(e) => setEditShare(e.target.value)}
              placeholder="输入持有份额（正整数）"
              className="share-input"
              confirmType="done"
            />
            <View className="modal-btns">
              <Button size="mini" onClick={() => setShowEditModal(false)}>取消</Button>
              <Button size="mini" type="primary" onClick={confirmEditShare}>确认修改</Button>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default Index;
