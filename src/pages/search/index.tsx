import { useState } from 'react';
import { View, Input, Button, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { searchStock } from '../../api/stock';
import { addCollect } from '../../utils/storage';
import { StockItem } from '../../types/stock';
import './index.scss';

const Search = () => {
  const [keyword, setKeyword] = useState('');
  const [searchResult, setSearchResult] = useState<StockItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFund, setCurrentFund] = useState<StockItem | null>(null);
  const [shareNum, setShareNum] = useState('');

  const handleSearch = async () => {
    if (!keyword.trim()) {
      Taro.showToast({ title: '请输入基金名称/代码', icon: 'none' });
      return;
    }
    let resultList: StockItem[] = [];
    try {
      const list = await searchStock(keyword.trim());
      if (Array.isArray(list)) resultList = list;
    } catch (e) {
      resultList = [];
    }
    setSearchResult(resultList);
  };

  const openShareModal = (fund: StockItem) => {
    setCurrentFund(fund);
    setShareNum('');
    setShowModal(true);
  };

  const confirmAddCollect = () => {
    if (!currentFund) return;
    const share = Number(shareNum);
    if (isNaN(share) || share <= 0) {
      Taro.showToast({ title: '请输入有效持仓份额', icon: 'none' });
      return;
    }
    addCollect({
      ...currentFund,
      holdShare: share
    });
    Taro.showToast({ title: '添加自选成功' });
    setShowModal(false);
  };

  return (
    <View className="page-search">
      {/* 搜索栏区域 */}
      <View className="search-header">
        <Input
          value={keyword}
          onInput={(e) => setKeyword(e.target.value)}
          placeholder="输入基金代码/名称，如001595、白酒"
          className="search-input"
        />
        <Button onClick={handleSearch} className="search-btn">搜索</Button>
      </View>

      {/* 搜索结果列表 */}
      <ScrollView className="result-scroll">
        {searchResult.length > 0 ? (
          searchResult.map(item => (
            <View key={item.code} className="stock-item">
              <View className="stock-info">
                <Text className="stock-name">{item.name}</Text>
                <Text className="stock-code">{item.code}</Text>
              </View>
              <Button size="mini" type="primary" onClick={() => openShareModal(item)}>添加自选</Button>
            </View>
          ))
        ) : (
          <View className="empty-tip">输入关键词搜索基金</View>
        )}
      </ScrollView>

      {/* 份额弹窗 */}
      {showModal && currentFund && (
        <View className="modal-mask" onClick={() => setShowModal(false)}>
          <View className="modal-box" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">设置 {currentFund.name} 持仓份额</Text>
            <Input
              type="digit"
              value={shareNum}
              onInput={(e) => setShareNum(e.target.value)}
              placeholder="输入持有份额，例：5000"
              className="share-input"
            />
            <View className="modal-buttons">
              <Button size="mini" onClick={() => setShowModal(false)}>取消</Button>
              <Button size="mini" type="primary" onClick={confirmAddCollect}>确认加入</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default Search;
