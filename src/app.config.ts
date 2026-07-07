export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/search/index',
    'pages/mine/index'
  ],
  window: {
    navigationBarTitleText: 'leek-assistant',
    navigationBarBackgroundColor: '#fff',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    list: [
      {
        pagePath: 'pages/index/index',
        text: '自选预测'
      },
      {
        pagePath: 'pages/search/index',
        text: '搜股票'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的'
      }
    ]
  },
  networkTimeout: {
    "request": 15000,
    "uploadFile": 15000,
    "downloadFile": 15000
  }
})
