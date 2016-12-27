var cmd=require('node-cmd');
var restify = require('restify');
var docker = require('docker-remote-api')
var request = docker({
  host: '/var/run/docker.sock'
})

// Start up haproxy
function restart_haproxy(data){
        if (!data){
           console.log("Starting HaProxy\n");
          } else {
           console.log("Failed HaProxy - " + data + "\nRestarting\n");
          }
	cmd.run('/usr/sbin/haproxy -f /etc/haproxy/haproxy.cfg -db',restart_haproxy);
}

restart_haproxy("");


function sendOK(req, res, next){
  res.statusCode = 200;
  res.send();
  next();
}

function respond(req, res, next) {
  res.send('hello ' + req.params.name);
  next();
}


var server = restify.createServer();
server.get('/check', sendOK);
server.get('/hello/:name', respond);
server.head('/hello/:name', respond);

request.get('/containers/json',function(err,containers){
	if (err) throw err;
        console.log('docker:', containers);
        });
};

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});

