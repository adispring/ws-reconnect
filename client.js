const EventEmitter = require('events')
const WebSocket = require('ws')
const EventTarget = require('ws/lib/event-target')
const { fromEvent } = require('rxjs')
const R = require('ramda')

class ReconnectWebSocket extends EventEmitter {
  constructor (config) {
    super()
    const defaultConfig = {
      autoReconnectInterval: 5000 // ms
    }
    this.config = R.mergeRight(defaultConfig, config)
    this.open()
  }

  open () {
    this.instance = new this.config.SocketCtor(this.config.url)
    this.instance.on('open', () => {
      if (typeof this.onopen === 'function') {
        this.onopen()
      }
    })
    this.instance.on('message', data => {
      if (typeof this.onmessage === 'function') {
        this.onmessage(data)
      }
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
      if (typeof this.onclose === 'function') {
        this.onclose(e)
      }
    })
    this.instance.on('error', e => {
      switch (e.code) {
        // WebSocket CloseEvent status code:
        // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
        case 'ECONNREFUSED':
          this.reconnect(e)
          break
        default:
          if (typeof this.onerror === 'function') {
            this.onerror(e)
          }
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
    console.log(
      `WebSocketClient: retry in ${this.config.autoReconnectInterval}ms`,
      e
    )
    this.instance.removeAllListeners()
    setTimeout(() => {
      console.log('WebSocketClient: reconnecting...')
      this.open(this.config.url)
    }, this.config.autoReconnectInterval)
  }
}

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
;['open', 'error', 'close', 'message'].forEach(method => {
  Object.defineProperty(ReconnectWebSocket.prototype, `on${method}`, {
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

ReconnectWebSocket.prototype.addEventListener = EventTarget.addEventListener
ReconnectWebSocket.prototype.removeEventListener =
  EventTarget.removeEventListener

var ws = new ReconnectWebSocket({
  url: 'ws://localhost:6000/',
  SocketCtor: WebSocket
})
const onopen$ = fromEvent(ws, 'open')
onopen$.subscribe(() => {
  console.log('WebSocketClient open')
  ws.send('Hello World!')
})
fromEvent(ws, 'message').subscribe(data => {
  console.log(`WebSocketClient message $: `, data)
})
fromEvent(ws, 'close').subscribe(e => {
  console.log(`WebSocketClient close: `, e)
})
