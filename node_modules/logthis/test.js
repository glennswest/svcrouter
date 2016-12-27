var path = require('path');
require('./logthis').config({ _on: true, 'test.js': 'debug' ,'test.js[foo]': 'debug'});

var logger = require('./logthis').logger;

var log = logger._create(path.basename(__filename));
var log2 = logger._create('someNamespace');
log2._enable();
var log3 = logger._create(path.basename(__filename), ['foo']);

log('hello');
log2('hello from log2');
log3.foo('hello from foo');

