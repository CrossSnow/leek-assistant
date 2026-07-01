import { useState, useEffect } from 'react';
import { View, Text, ScrollView, MovableArea, MovableView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getCollectList, delCollect, addCollect } from '../../utils/storage';
import { getStockDailyInfo } from '../../api/stock';
import { formatPercent, formatProfit, getRiseClass } from '../../utils/format';
import { StockDailyData, StockItem } from '../../types/stock';
import './index.scss';

type StockCombine = StockItem & StockDailyData & { loadError: boolean };

const Index = () => {
  const [stockDataList, setStockDataList] = useState<StockCombine[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFund, setEditFund] = useState<StockCombine | null>(null);
  const [editShare, setEditShare] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // 加载/刷新基金数据（allSettled 单条失败不影响整体）
  const fetchAllStockInfo = async () => {
    const collectList = getCollectList();
    if (collectList.length === 0) {
      setStockDataList([]);
      return;
    }

    const promiseList = collectList.map(async (item) => {
      try {
        const data = await getStockDailyInfo(item.code, item.holdShare);
        return { ...item, ...data, loadError: false };
      } catch (err) {
        // 单只基金请求失败，返回标记错误的对象，不抛出阻断
        return {
          ...item,
          code: item.code,
          name: item.name,
          nowPrice: 0,
          yesterdayClose: 0,
          risePercent: 0,
          todayPredictProfit: 0,
          predictDesc: '',
          holdShare: item.holdShare,
          loadError: true
        };
      }
    });

    // 等待全部请求完成，无论成功失败
    const allResult = await Promise.allSettled(promiseList);
    const validList: StockCombine[] = [];
    allResult.forEach(item => {
      if (item.status === 'fulfilled') {
        validList.push(item.value);
      }
    });
    setStockDataList(validList);
  };

  // 下拉刷新触发
  const onPullRefresh = async () => {
    setRefreshing(true);
    await fetchAllStockInfo();
    setRefreshing(false);
    Taro.showToast({ title: '刷新完成', icon: 'none' });
  };

  const handleDel = (code: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要移除这只基金自选吗？',
      success: (res) => {
        if (res.confirm) {
          delCollect(code);
          fetchAllStockInfo();
        }
      }
    });
  };

  const openEditShareModal = (fund: StockCombine) => {
    setEditFund(fund);
    setEditShare(String(fund.holdShare));
    setShowEditModal(true);
  };

  const confirmEditShare = () => {
    if (!editFund) return;
    const share = Number(editShare);
    if (isNaN(share) || share <= 0) {
      Taro.showToast({ title: '请输入有效份额', icon: 'none' });
      return;
    }
    addCollect({
      code: editFund.code,
      name: editFund.name,
      holdShare: share
    });
    setShowEditModal(false);
    Taro.showToast({ title: '份额修改成功' });
    fetchAllStockInfo();
  };

  useEffect(() => {
    fetchAllStockInfo();
  }, []);

  return (
    <ScrollView
      className="page-index"
      scrollY
      enablePullDownRefresh
      onPullDownRefresh={onPullRefresh}
      refresherTriggered={refreshing}
      refresherEnabled
    >
      <View className="tip">下拉页面刷新行情｜卡片右滑可修改份额/删除</View>
      {stockDataList.length === 0 ? (
        <View className="empty">暂无自选基金<br/>前往搜索页添加持仓基金</View>
      ) : (
        stockDataList.map((stock) => (
          <MovableArea key={stock.code} className="slide-area">
            <View className="slide-action">
              <View
                className="btn-edit"
                onClick={() => openEditShareModal(stock)}
              >
                <Text>改份额</Text>
              </View>
              <View
                className="btn-del"
                onClick={() => handleDel(stock.code)}
              >
                <Text>删除</Text>
              </View>
            </View>
            <MovableView
              className="stock-card"
              direction="horizontal"
              outOfBounds
              x={0}
              moveSpeed={6}
            >
              <View className="stock-head">
                <Text className="name">{stock.name}</Text>
                {!stock.loadError && (
                  <Text className={getRiseClass(stock.risePercent)}>
                    {formatPercent(stock.risePercent)}
                  </Text>
                )}
              </View>
              <Text className="stock-code">基金代码：{stock.code}</Text>

              {/* 接口异常判断 */}
              {stock.loadError ? (
                <View className="error-tip">
                  <Text>⚠️ 行情数据获取异常，下拉刷新重试</Text>
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
                </>
              )}
            </MovableView>
          </MovableArea>
        ))
      )}

      {showEditModal && editFund && (
        <View className="modal-mask" onClick={() => setShowEditModal(false)}>
          <View className="modal-box" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">修改 {editFund.name} 持仓份额</Text>
            <Input
              type="digit"
              value={editShare}
              onInput={(e) => setEditShare(e.target.value)}
              placeholder="输入持有基金份额"
              className="share-input"
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
