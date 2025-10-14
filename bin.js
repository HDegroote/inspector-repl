#!/usr/bin/env node

const path = require('path')
const b4a = require('b4a')
const InspectorRepl = require('.')

const repl = new InspectorRepl(process.argv[2])
repl.on('console-message', m => {
  console.log(m)
})
repl.on('heapdump-done', loc => {
  console.log(`Heapdump finished at ${loc}`)
})
repl.on('cpu-profile-saved', loc => {
  console.log(`CPU profile finished at ${loc}`)
})
repl.on('cpu-profile-error', err => {
  console.warn(`CPU profile errored: ${err.stack}`)
})

process.stdin.on('data', function (data) {
  const cleanData = b4a.toString(data).trim()
  if (cleanData.startsWith('heapdump')) {
    let heapdumpLocation = cleanData.split(' ')[1]
    if (!heapdumpLocation) {
      const timestamp = new Date(Date.now()).toISOString().split('.')[0].replaceAll(':', '-')
      heapdumpLocation = `inspector-repl-${timestamp}.heapsnapshot`
    }
    heapdumpLocation = path.resolve(heapdumpLocation)
    console.log(`Creating heapdump at ${heapdumpLocation}`)

    repl.heapdump(heapdumpLocation)
    return
  }

  if (cleanData.startsWith('profiler')) {
    const profileLength = cleanData.split(' ')[1] || 5_000
    let cpuProfileLocation = cleanData.split(' ')[2]
    if (!cpuProfileLocation) {
      const timestamp = new Date(Date.now()).toISOString().split('.')[0].replaceAll(':', '-')
      cpuProfileLocation = `inspector-repl-${timestamp}.cpuprofile`
    }
    cpuProfileLocation = path.resolve(cpuProfileLocation)
    console.log(`Creating CPU profile of ${profileLength}ms at ${cpuProfileLocation}`)

    repl.profile(profileLength, cpuProfileLocation)
    return
  }

  repl.evaluate('' + data.toString().trim())
})

console.log('Available commands:\n- heapdump <location>?\n- profiler <lengthMs>? <location>?')
