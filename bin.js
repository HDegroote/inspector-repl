#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const WS = require('ws')
const b4a = require('b4a')

const socket = new WS(process.argv[2])

let heapdumpLocation = null
let heapdumpMessageId = -1
let cpuProfileLocation = null
let cpuProfileMessageId = null

socket.on('message', function (data) {
  const m = JSON.parse(data)
  if (m.method === 'Console.messageAdded') {
    console.log(m.params.message.text)
  } else if (m.method === 'HeapProfiler.addHeapSnapshotChunk') {
    fs.appendFileSync(heapdumpLocation, m.params.chunk)
  } else if (!m.method && m.result) {
    if (m.id === heapdumpMessageId) {
      console.log(`Heapdump finished at ${heapdumpLocation}`)
    } else if (m.id === cpuProfileMessageId) {
      console.log(`Saving CPU profile to ${cpuProfileLocation}`)
      fs.promises.writeFile(cpuProfileLocation, JSON.stringify(m.result.profile))
        .then(() => { console.log('Saved CPU profile')})
        .catch((e) => console.error(e))
    } else {
      console.log(m.result.result?.value)
    }
  }
})

socket.on('open', function () {
  socket.send(JSON.stringify({
    id: 0,
    method: 'Console.enable'
  }))

  socket.send(JSON.stringify({
    id: 1,
    method: 'HeapProfiler.enable'
  }))

  socket.send(JSON.stringify({
    id: 2,
    method: 'Profiler.enable'
  }))


  let id = 3

  process.stdin.on('data', function (data) {
    const cleanData = b4a.toString(data).trim()
    if (cleanData.startsWith('heapdump')) {
      heapdumpLocation = cleanData.split(' ')[1]
      if (!heapdumpLocation) {
        const timestamp = new Date(Date.now()).toISOString().split('.')[0].replaceAll(':', '-')
        heapdumpLocation = `inspector-repl-${timestamp}.heapsnapshot`
      }
      heapdumpLocation = path.resolve(heapdumpLocation)
      console.log(`Creating heapdump at ${heapdumpLocation}`)

      heapdumpMessageId = id
      socket.send(JSON.stringify({
        id: id++,
        method: 'HeapProfiler.takeHeapSnapshot',
      }))

      return
    }

    if (cleanData.startsWith('profiler')) {
      const profileLength = cleanData.split(' ')[1] || 5_000
      cpuProfileLocation = cleanData.split(' ')[2]
      if (!cpuProfileLocation) {
        const timestamp = new Date(Date.now()).toISOString().split('.')[0].replaceAll(':', '-')
        cpuProfileLocation = `inspector-repl-${timestamp}.cpuprofile`
      }
      cpuProfileLocation = path.resolve(cpuProfileLocation)
      console.log(`Creating CPU profile of ${profileLength}ms at ${cpuProfileLocation}`)

      socket.send(JSON.stringify({
        id: id++,
        method: 'Profiler.start',
      }))

      setTimeout(() => {
        cpuProfileMessageId = id++
        socket.send(JSON.stringify({
          id: cpuProfileMessageId,
          method: 'Profiler.stop'
        }))
      }, profileLength)

      return
    }

    socket.send(JSON.stringify({
      id: id++,
      method: 'Runtime.evaluate',
      params: { expression: '' + data.toString().trim() }
    }))
  })
})

console.log('Available commands:\n- heapdump <location>?\n- profiler <lengthMs>? <location>?')
