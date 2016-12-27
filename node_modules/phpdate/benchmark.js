'use strict'

var Benchmark = require('benchmark')
var suite = new Benchmark.Suite()
var date = require('.')

suite.add('Y-m-d H:i:s', function () {
  date('Y-m-d H:i:s')
})

suite.add('c', function () {
  date('c')
})

suite.add('r', function () {
  date('r')
})

suite.on('cycle', function (event) {
  console.log(String(event.target))
})

suite.run()
