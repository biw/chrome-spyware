'use strict'

window.chrome.browserAction.onClicked.addListener((activeTab) => {
  window.chrome.tabs.create({ url: 'https://www.netflix.com/' })
})
