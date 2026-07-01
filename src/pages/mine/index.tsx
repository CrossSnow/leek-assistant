import { View, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { clearAllCollect } from '../../utils/storage';
import './index.scss';

const Mine = () => {
  const handleClear = () => {
    Taro.showModal({
      title: '提示',
      content: '确定清空全部自选？本地持仓数据将无法恢复',
      success: (res) => {
        if (res.confirm) {
          clearAllCollect();
          Taro.showToast({ title: '已清空所有自选' });
        }
      }
    });
  };

  return (
    <View className="page-mine">
      <View className="card-wrap">
        <Button type="warn" onClick={handleClear} className="clear-btn">清空全部自选缓存</Button>
        <Text className="tip-text">清空后所有持仓份额、基金记录都会删除</Text>
      </View>
    </View>
  );
};

export default Mine;
