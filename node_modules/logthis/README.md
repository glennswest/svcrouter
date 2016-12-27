##Logthis

A little namespaced logging utility for node and the browser.

In the browser the state of loggers gets persisted in localStorage.

Some inspiration was taken from
[https://github.com/visionmedia/debug](https://github.com/visionmedia/debug),
mainly the idea of storing state of a debugger in localStorage.

The idea is that by default all log output is silent and has minimal impact on
the app. All log calls are reduced to empty noop calls. In production all log
calls are automatically silenced. To debug the app, turn the appropriate set of
debug or log calls on, and turn them off again when working on different section
of code. All log statements are prefixed with their namespace, the name of the
function the call was made from, and its line number in the source file for easy
tracking of the position of the log call in the source code.

In node the state of loggers is passed in as a config json (or use a nodejs repl
perhaps?)

Load the script with:

     <script src=pathto/logthis.js></script>
	 
Or on node:

	npm install logthis
	
In the browser a new global is created named logthis, this can be changed, see top of source
file.

Turn logthis on for your browser:

	logthis._on();
	
The state of logthis gets persisted in localStorage, turn logthis off with:

	logthis._off();
	
Check the state with:

	logthis._state; //on or off
	
When turned off all log calls in your source code are just noop calls (`function() {}`).

Turning logthis on or off requires a refresh of the browser to have any effect.

When turned on, `logthis` itself is a logger already, however it starts of as
disabled as any logger created with `logthis`. Enable it:

	logthis._enable();
	
Then use it as a default logger:

	logthis('Hello');// same as console.log
	
Or use a log level:

	logthis._e('error'); //printed with stack trace
	logthis._w('warning); //printed with alarm icon on the browser
	logthis._i('info); //printed with info icon on the browser
	logthis._d('debug); //standard console.log
	
Set the loglevel for this logger:

	logthis._setLevel('warning'); //only warning and errors are printed
	
Levels can be `debug`, `info`, `warning`, `error` or `none`.
	
Enabling a logger is the same as setting the log level to `debug`. Disabling a
logger is the same as setting the level to `none`. 

The state of any logger gets persisted in localStorage. This means that opening
your page in a different browser will show no log output till you turn on
logthis and enable the loggers you're interested in. Or you can do this in your
source code, however then it's a bit cumbersome to disable all the loggers off
again.

By default loggers print out a timestamp, disable the timestamp with:

	logthis._showTimeStamp = false;//set in source file to persist
	
Or disable the logger alltogether:

	logthis._disable(); //in effect setting a 'none' error level.
	
Make a new namespaced logger with:

    var log = logthis._create('nameOfLogger); 
	
If you create a logger with the same name, you get the same logger again.

This logger `log` has the same methods as described above for he default logger,
and can be enabled and disabled separately from any other loggers.

Enable a name spaced logger with:

	logthis.nameOfLogger._enable();
	
or 
	
	log._enable();
	
Every logger prints out its name before any output:

	log('And this is the log message.');

	--> (3m)nameOfLogger:108>And this is the log message.
	
And the line number (108) the log call was made.	

The time stamp (3m) is from when the script was first loaded, except when calls are
in quick succession (within 2 seconds), then the time stamp is relative to the first of the batch
(eg: +5ms).

You can namespace further like this:

	logthis('nameOfLogger', ['foo']);
	
Enable it in the browser:
	
	log.foo._enable();
	
Use the logger:

	log.foo('hello!');
	
Use this for example to quickly create a logger for some functions, turn the
logger off when you're done, but leave the log calls in place, in case they are
useful again later.	

Enumerate all loggers:

	logthis._enum();
	
	--> default (debug) 
	--> nameOfLogger (debug) ["foo (debug)"] 
	
Disable or enable all loggers under a namespace:

	logthis.nameOfLogger._all.enable();
	logthis.nameOfLogger._all.disable();
	
This also works for the default logthis:

	logthis._all.enable();
	logthis._all.disable();
	
However this does only affect the top level loggers.	

Set the minimum global logging level for all loggers:

	logthis.setGlobalLevel('warning); //add to source file to persist
	
This sets the minimum levels of all loggers. In this case for example no info or
debug statements will be printed.

Example for use on node:

	var path = require('path');
	require('logthis').config({ _on: true, 'test.js': 'debug' ,'test.js[foo]': 'debug'});

	var logthis = require('./logthis').logger;

	var log = logthis._create(path.basename(__filename));
	var log2 = logthis._create('some_namespace));
	var log3 = logthis._create(path.basename(__filename), ['foo']);

	log('hello');
	log2('hello from log2');
	log3.foo('hello from foo');

Output:

	test.js anon():11> hello (+13ms)
	some_namespace anon():12> hello from log2 (+3ms)
	test.js[foo] anon():13> hello from foo (+1ms)

	Process test.js finished

To completely remove all log statements from a script, maybe use Douglas Crockford's JSDev
https://github.com/douglascrockford/JSDev

console.debug, console.warn, console.info and
console.error are used under the covers in the browser.

TODO:

*  detect console object, fail gracefully
*  pass through other console properties
*  maybe store messages to output somewhere else
   maybe send to a logserver?
*  implement custom colors and format string
*  maybe use a node repl?
* use only _create to make new loggers, not as an second array option, so add
   _create to namespaced loggers as well.
* clean up and comment source code (maybe doccoh it)
   
