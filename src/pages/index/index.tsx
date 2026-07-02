import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Input, Button, Navigator } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getCollectList, delCollect, addCollect } from '../../utils/storage';
import { getFundDailyInfo } from '../../api/stock';
import { formatPercent, formatProfit, getRiseClass } from '../../utils/format';
import { StockDailyData, StockItem } from '../../types/stock';
import './index.scss';

type StockCombine = StockItem & StockDailyData & { loadError: boolean };

const Index = () => {
  const [stockDataList, setStockDataList] = useState<StockCombine[]>([]);
  // 修改份额弹窗
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFund, setEditFund] = useState<StockCombine | null>(null);
  const [editShare, setEditShare] = useState('');
  // 长按操作弹窗
  const [showLongPressModal, setShowLongPressModal] = useState(false);
  const [currentOperateStock, setCurrentOperateStock] = useState<StockCombine | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // 加载/刷新持仓估值
  const fetchAllStockInfo = async () => {
    try {
      console.log('=====开始加载自选=====');
      const collectList = getCollectList();
      console.log('本地自选缓存列表：', collectList);

      if (collectList.length === 0) {
        console.log('本地自选为空，清空页面列表');
        setStockDataList([]);
        return;
      }

      const promiseList = collectList.map(async (item) => {
        console.log('请求标的：', item.code, item);
        const data = await getFundDailyInfo(item.code, item.holdShare);
        const combine = { ...item, ...data, name: item.name };
        console.log('单条合并结果：', combine);
        return combine;
      });

      const allResult = await Promise.all(promiseList);
      console.log('全部行情请求完成，最终渲染列表：', allResult);
      setStockDataList(allResult);
    } catch (e) {
      console.error('加载自选全局异常：', e);
      Taro.showToast({ title: '读取自选列表失败', icon: 'none' });
    }
  };

  // 下拉刷新
  const onPullRefresh = async () => {
    setRefreshing(true);
    await fetchAllStockInfo();
    setRefreshing(false);
    Taro.showToast({ title: '刷新完成', icon: 'none' });
  };

  // 删除自选
  const handleDel = (code: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定移除这条自选持仓吗？',
      success: (res) => {
        if (res.confirm) {
          delCollect(code);
          fetchAllStockInfo();
        }
      }
    });
    // 关闭长按弹窗
    setShowLongPressModal(false);
    setCurrentOperateStock(null);
  };

  // 打开修改份额弹窗
  const openEditShareModal = (stock: StockCombine) => {
    setEditFund(stock);
    setEditShare(String(stock.holdShare));
    setShowEditModal(true);
    // 关闭长按弹窗
    setShowLongPressModal(false);
  };

  // 确认修改份额
  const confirmEditShare = () => {
    if (!editFund) return;
    const share = Number(editShare.trim());
    if (isNaN(share) || share <= 0 || !Number.isInteger(share)) {
      Taro.showToast({ title: '请输入正整数份额', icon: 'none' });
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

  // 长按卡片触发操作弹窗
  const handleLongPressCard = (stock: StockCombine) => {
    setCurrentOperateStock(stock);
    setShowLongPressModal(true);
  };

  // 页面首次加载 + 切页自动刷新
  useEffect(() => {
    fetchAllStockInfo();
    const onShow = () => fetchAllStockInfo();
    Taro.eventCenter.on('pageShow', onShow);
    return () => Taro.eventCenter.off('pageShow', onShow);
  }, []);

  return (
    <ScrollView
      className="page-index"
      scrollY
      enablePullDownRefresh
      onPullDownRefresh={onPullRefresh}
      refresherTriggered={refreshing}
      refresherEnabled
      style={{ height: '100vh' }}
    >
      <View className="scroll-wrap">
        <View className="tip">下拉页面刷新行情｜长按卡片可修改份额/删除</View>
        {stockDataList.length === 0 ? (
          <View className="empty">
            <Text>暂无自选持仓</Text>
            <Navigator url="/pages/search/index" className="empty-btn">
              <Button size="mini" type="primary">前往搜索添加持仓</Button>
            </Navigator>
          </View>
        ) : (
          stockDataList.map((stock) => (
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
            </View>
          ))
        )}
      </View>

      {showLongPressModal && currentOperateStock && (
        <View className="modal-mask" onClick={() => setShowLongPressModal(false)}>
          <View className="operate-modal-box" onClick={(e) => e.stopPropagation()}>
            <Text className="operate-title">{currentOperateStock.name}</Text>
            <View className="operate-btn-group">
              <Button
                className="operate-btn edit"
                onClick={() => openEditShareModal(currentOperateStock)}
              >
                修改份额
              </Button>
              <Button
                className="operate-btn del"
                danger
                onClick={() => handleDel(currentOperateStock.code)}
              >
                删除自选
              </Button>
              <Button
                className="operate-btn cancel"
                onClick={() => setShowLongPressModal(false)}
              >
                取消
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 修改份额弹窗 */}
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
