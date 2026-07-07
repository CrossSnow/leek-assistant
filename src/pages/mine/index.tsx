import { useState, useEffect } from 'react';
import { View, Button, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { clearAllCollect, getProfitHistory, ProfitRecord } from '../../utils/storage';
import { formatProfit } from '../../utils/format';
import './index.scss';

const Mine = () => {
  const [profitList, setProfitList] = useState<ProfitRecord[]>([]);

  // 加载收益历史，倒序展示（最新日期在上）
  const loadProfitData = () => {
    const data = getProfitHistory();
    setProfitList([...data].reverse());
  };

  useEffect(() => {
    loadProfitData();
  }, []);

  const handleClear = () => {
    Taro.showModal({
      title: '提示',
      content: '确定清空全部自选？本地持仓、15天收益历史数据将无法恢复',
      success: (res) => {
        if (res.confirm) {
          clearAllCollect();
          Taro.showToast({ title: '已清空所有自选' });
          setProfitList([]);
        }
      }
    });
  };

  return (
    <View className="page-mine">
      {/* 近15天每日收益卡片 */}
      <View className="profit-card">
        <Text className="card-title">近15天每日收益</Text>
        {profitList.length === 0 ? (
          <Text className="empty-tip">暂无收益记录，前往持仓页面刷新自动生成</Text>
        ) : (
          <ScrollView className="profit-scroll">
            {profitList.map((item, index) => (
              <View key={index} className="profit-row">
                <Text className="profit-date">{item.date}</Text>
                <Text className={`profit-num ${item.profit >= 0 ? 'rise' : 'fall'}`}>
                  {formatProfit(item.profit)} 元
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 清空自选模块 */}
      <View className="card-wrap">
        <Button type="warn" onClick={handleClear} className="clear-btn">清空全部自选缓存</Button>
        <Text className="tip-text">清空后所有持仓份额、基金、收益记录都会删除</Text>
      </View>
    </View>
  );
};

export default Mine;
