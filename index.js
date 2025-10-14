const { EventEmitter } = require('events')
const fs = require('fs')
const WS = require('ws')

class InspectorRepl extends EventEmitter {
  constructor (wsUrl) {
    super()

    this.socket = new WS(wsUrl)
    this._heapdumpMessageId = null
    this._cpuProfileMessageId = null
    this._msgId = 0
    this._heapdumpLocation = null
    this._cpuProfileLocation = null

    this.socket.on('message', this._onmessage.bind(this))
    this.socket.on('open', () => {
      this.socket.send(JSON.stringify({
        id: 0,
        method: 'Console.enable'
      }))

      this.socket.send(JSON.stringify({
        id: 1,
        method: 'HeapProfiler.enable'
      }))

      this.socket.send(JSON.stringify({
        id: 2,
        method: 'Profiler.enable'
      }))

      this._msgId += 3
    })
  }

  _onmessage (data) {
    const m = JSON.parse(data)
    if (m.method === 'Console.messageAdded') {
      this.emit('console-message', m.params.message.text)
    } else if (m.method === 'HeapProfiler.addHeapSnapshotChunk') {
      fs.appendFileSync(this._heapdumpLocation, m.params.chunk)
    } else if (!m.method && m.result) {
      if (m.id === this._heapdumpMessageId) {
        this.emit('heapdump-done', this._heapdumpLocation)
      } else if (m.id === this._cpuProfileMessageId) {
        fs.promises.writeFile(this._cpuProfileLocation, JSON.stringify(m.result.profile))
          .then(() => { this.emit('cpu-profile-saved', this._cpuProfileLocation) })
          .catch((e) => { this.emit('cpu-profile-error', e) })
      } else {
        this.emit('console-message', m.result.result?.value)
      }
    }
  }

  heapdump (location) {
    this._heapdumpLocation = location
    this._heapdumpMessageId = this._msgId
    this.socket.send(JSON.stringify({
      id: this._msgId++,
      method: 'HeapProfiler.takeHeapSnapshot'
    }))
  }

  profile (length, location) {
    this._cpuProfileLocation = location
    this._cpuProfileMessageId = this._msgId + 1
    this.socket.send(JSON.stringify({
      id: this._msgId+=2, // also for the response
      method: 'Profiler.start'
    }))
    setTimeout(() => {
      this.socket.send(JSON.stringify({
        id: this._cpuProfileMessageId,
        method: 'Profiler.stop'
      }))
    }, length)
  }

  evaluate (expression) {
    this.socket.send(JSON.stringify({
      id: this._msgId++,
      method: 'Runtime.evaluate',
      params: { expression }
    }))
  }
}

module.exports = InspectorRepl
