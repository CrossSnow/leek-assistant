import { useState } from 'react';
import { View, Input, Button, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { searchStock } from '../../api/stock';
import { addCollect } from '../../utils/storage';
import { StockItem } from '../../types/stock';
import './index.scss';

// 筛选类型定义
type FilterType = 'all' | '基金' | '股票';

const Search = () => {
  const [keyword, setKeyword] = useState('');
  const [searchResult, setSearchResult] = useState<StockItem[]>([]);
  // 当前选中筛选
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
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
    // 搜索后重置筛选为全部
    setActiveFilter('all');
  };

  // 根据筛选过滤结果
  const filterResult = searchResult.filter(item => {
    if (activeFilter === 'all') return true;
    return item.tag === activeFilter;
  });

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

      {/* 筛选按钮区域 */}
      <View className="filter-tab">
        <Button
          size="mini"
          className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          全部
        </Button>
        <Button
          size="mini"
          className={`filter-btn ${activeFilter === '基金' ? 'active' : ''}`}
          onClick={() => setActiveFilter('基金')}
        >
          仅基金
        </Button>
        <Button
          size="mini"
          className={`filter-btn ${activeFilter === '股票' ? 'active' : ''}`}
          onClick={() => setActiveFilter('股票')}
        >
          仅股票
        </Button>
      </View>

      {/* 搜索结果列表 */}
      <ScrollView className="result-scroll">
        {filterResult.length > 0 ? (
          filterResult.map(item => (
            <View key={item.code} className="stock-item">
              <View className="stock-info">
                <Text className="stock-name">{item.name}</Text>
                <Text className="stock-code">{item.code}</Text>
              </View>
              {/* 分类标签 */}
              <Text className={`item-tag ${item.tag === '基金' ? 'tag-fund' : 'tag-stock'}`}>
                {item.tag || '未知'}
              </Text>
              <Button size="mini" type="primary" onClick={() => openShareModal(item)}>添加自选</Button>
            </View>
          ))
        ) : (
          <View className="empty-tip">
            {searchResult.length ? '当前筛选无匹配数据' : '输入关键词搜索基金'}
          </View>
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
