'use strict';

//
// Module dependencies
//
var HAProxy = require('./');

//
// Access our local HAProxy
//
var haproxy = new HAProxy('/tmp/haproxy.sock', {
  config: '/Users/V1/Projects/observer/balancerbattle/haproxy.cfg',
  pidFile: '/Users/V1/Projects/observer/haproxy.pid'
});

haproxy.start(function start(err, warnings) {
  console.log('started on pid;', this.pid);

  this.reload(function () {
    console.log('now running on pid;', this.pid);

    this.stop(function stop() {
      console.log('killed the old pid again', arguments);
    });
  });
});
