const EventEmitter = require('events')
const WebSocket = require('ws')
const EventTarget = require('ws/lib/event-target')
const { fromEvent } = require('rxjs')

class WebSocketClient extends EventEmitter {
  constructor (opts) {
    super()
    const { url, SocketCtor, autoReconnectInterval = 5000 } = opts
    this.number = 0 // Message number
    this.url = url
    this.SocketCtor = SocketCtor
    this.autoReconnectInterval = autoReconnectInterval
    this.open()
  }

  open () {
    this.instance = new this.SocketCtor(this.url)
    this.instance.on('open', () => {
      this.onopen()
    })
    this.instance.on('message', (data, flags) => {
      this.number++
      this.onmessage(data, flags, this.number)
    })
    this.instance.on('close', e => {
      switch (e.code) {
        case 1000: // CLOSE_NORMAL
          console.log('WebSocket: closed')
          break
        default:
          // Abnormal closure
          this.reconnect(e)
          break
      }
      this.onclose(e)
    })
    this.instance.on('error', e => {
      switch (e.code) {
        case 'ECONNREFUSED':
          this.reconnect(e)
          break
        default:
          this.onerror(e)
          break
      }
    })
  }

  send (data, option) {
    try {
      this.instance.send(data, option)
    } catch (e) {
      this.instance.emit('error', e)
    }
  }

  reconnect (e) {
    console.log(`WebSocketClient: retry in ${this.autoReconnectInterval}ms`, e)
    this.instance.removeAllListeners()
    setTimeout(() => {
      console.log('WebSocketClient: reconnecting...')
      this.open(this.url)
    }, this.autoReconnectInterval)
  }

  onopen (e) {
    console.log('WebSocketClient: open', arguments)
  }
  onmessage (data, flags, number) {
    console.log('WebSocketClient: message', arguments)
  }
  onerror (e) {
    console.log('WebSocketClient: error', arguments)
  }
  onclose (e) {
    console.log('WebSocketClient: closed', arguments)
  }
}

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
;['open', 'error', 'close', 'message'].forEach(method => {
  Object.defineProperty(WebSocketClient.prototype, `on${method}`, {
    /**
     * Return the listener of the event.
     *
     * @return {(Function|undefined)} The event listener or `undefined`
     * @public
     */
    get () {
      const listeners = this.listeners(method)
      for (var i = 0; i < listeners.length; i++) {
        if (listeners[i]._listener) return listeners[i]._listener
      }

      return undefined
    },
    /**
     * Add a listener for the event.
     *
     * @param {Function} listener The listener to add
     * @public
     */
    set (listener) {
      const listeners = this.listeners(method)
      for (var i = 0; i < listeners.length; i++) {
        //
        // Remove only the listeners added via `addEventListener`.
        //
        if (listeners[i]._listener) this.removeListener(method, listeners[i])
      }
      this.addEventListener(method, listener)
    }
  })
})

WebSocketClient.prototype.addEventListener = EventTarget.addEventListener
WebSocketClient.prototype.removeEventListener = EventTarget.removeEventListener

var wsc = new WebSocketClient({
  url: 'ws://localhost:6000/',
  SocketCtor: WebSocket
})
/* wsc.onopen = function (e) { */
/* console.log('WebSocketClient connected:', e) */
/* this.send('Hello World !') */
/* } */
fromEvent(wsc, 'message').subscribe(data => {
  console.log(`WebSocketClient message #: `, data)
})
fromEvent(wsc, 'open').subscribe(e => {
  console.log(`open: ${e}`)
  wsc.send('Hello World!')
})
/* wsc.onmessage = function (data, flags, number) { */
/* console.log(`WebSocketClient message #${number}: `, data) */
/* } */
