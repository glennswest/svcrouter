require('log-timestamp')(function() { return new Date().toString() + ' %s' });
var fssync = require('fs-sync');
var fs = require('fs');
var util=require('util');
var process=require('process');
var execFile=require('child_process').execFile;
var restify = require('restify');
var Docker = require('dockerode');
var docker = new Docker();
var mqtt = require('mqtt')
var uuid = require('uuid/v4');
var myuuid = uuid();
var haproxy_pid = 0;

apps = [];

var myIP = process.env.myIP;
console.log("My IP is: " + myIP);


var mymqtt  = mqtt.connect('mqtt://' + myIP);
var servicedata = {name: "svcrouter",ip: myIP, id: myuuid, version: "v1"};

mymqtt.on('connect', function(){
    mymqtt.subscribe('servicediscovery');
    mymqtt.publish('servicediscovery',JSON.stringify(servicedata));
    }
)

mymqtt.on('message', function(topic, messagestr){
        message = JSON.parse(messagestr);
        console.log("message: " + topic + "message: " + util.inspect(message));
        switch(topic){
            // Expect: var servicedata = {name: "svcdns",ip: myIP, id: myuuid, version: "v1"};
            case "servicediscovery":
                 switch(message.name){
                     case "svcdns":
                          send_dnsresync_message();
                          break;
                     default:
                          break;
                     }
               break;
            default:
               break;
         }

});

function send_dnsresync_message()
{
	message = {};
        a = [];
	console.log("Doing DNS Resync");
	apps.forEach(function(entry){
          e = {};
          e.name = entry.hostname + ".";
          hostarray = e.name.split(".");
          hostarray.shift();
          zone = hostarray.join('.');
          console.log(zone);
          if (zone == ''){
             zone = 'nod.site.com.';
             name = e.name + zone;
             e.name = name;
             }
          e.zone = zone;
          e.ip   = entry.ip;
          a.push(e);
          });
       message.a = a;
       console.log("dnssync: " + util.inspect(message));
       mymqtt.publish('svcdnssync',JSON.stringify(message));
       return;
}

function add_host_name(name, ip){
        console.log("Add DNS Entry for " + name + "(" + ip + ")");
	message = {};
	message.name = name;
        message.ip = ip;
        message.version = 'v1';
        mymqtt.publish('svcdnsadd',JSON.stringify(message));
        return;
}

// Start up haproxy
function restart_haproxy(data){

        if (!data){
           console.log("Starting HaProxy");
          } else {
           console.log("Failed HaProxy - " + data + "Restarting");
          }
	//x = cmd.run('/usr/sbin/haproxy -f /etc/haproxy/haproxy.cfg -db &',restart_haproxy);
        child = execFile('/usr/sbin/haproxy',['-f','/etc/haproxy/haproxy.cfg','-db'], (error, stdout, stderr) => {
                if (error){
                   console.log("Error On Exec: " + util.inspect(error) + "");
                   } 
                restart_haproxy("Restarting HA Proxy");
                });
        console.log("HaProxy PID= " + util.inspect(child.pid) + "");
        haproxy_pid = child.pid;
}

restart_haproxy();

function reread_haproxy(){
       console.log("Force a reread of config - PID: " + haproxy_pid + "");
       process.kill(haproxy_pid,'SIGUSR1');
}

//frontend  http-in
//    bind *:80
//    mode http
//    acl host_sitetest hdr(host) -i test.site.com
//    use_backend test_site_cluster if host_sitetest
//
//backend test_site_cluster
//    #mode http
//    balance roundrobin
//    option httpchk get /check
//    http-check expect status 200
//    option httpclose
//    option forwardfor
//    server node1 127.0.0.1:32768 maxconn 32
//cI: { id: 'ec126df2397adb3b579716de27423e1079c7af1eb881697ca353b62b80ab3b73',
//  name: '/test.site.com',
//  ports: 
//   [ { IP: '0.0.0.0',
//       PrivatePort: 8080,
//       PublicPort: 32781,
//       Type: 'tcp' } ],
//   seen: true }

function WriteHaProxyConfig(){
        console.log("Updating HaProxyConfig");
	myIP = process.env.myIP;
        options = {};
        options.force = true;
        fssync.copy('/etc/haproxy/haproxy-base.cfg','/etc/haproxy/haproxy.cfg',options);
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','\n# Updated by svcrouter\n');
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','frontend  http-in\n');
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','    bind *:80\n');
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','    mode http\n');
        apps.forEach(function(entry){
            if (entry.ports.length > 0){
               hostname = entry.name.slice(1);
               name = hostname.replace(/\./gi,'_');
               line = '    acl host_' + name + ' hdr(host) -i ' + hostname + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               line = '    use_backend ' + name + '_cluster if host_' + name + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               }
            });
        apps.forEach(function(entry){
            if (entry.ports.length > 0){
               hostname = entry.name.slice(1);
               name = hostname.replace(/\./gi,'_');
               line = 'backend ' + name + '_cluster' + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    balance roundrobin\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpchk get /check\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    http-check expect status 200\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpclose\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option forwardfor\n');
               theport = entry.ports[0].PublicPort;
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    server node1 127.0.0.1:' + theport + ' maxconn 32\n');
               }
            });
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','\n');
        reread_haproxy();
}

//cI: { Id: 'ec126df2397adb3b579716de27423e1079c7af1eb881697ca353b62b80ab3b73',
//  Names: [ '/test.site.com' ],
//  Image: 'testapp',
//  ImageID: 'sha256:fd8bdd2997752e35da4a96904e609851c88c0e75ca94590abb4bc5966c2b2630',
//  Command: 'node index.js',
//  Created: 1482822186,
//  Ports: 
//   [ { IP: '0.0.0.0',
//       PrivatePort: 8080,
//       PublicPort: 32781,
//       Type: 'tcp' } ],
//  Labels: {},
//  Status: 'Up 3 minutes',
//  HostConfig: { NetworkMode: 'default' },
//  NetworkSettings: { Networks: { bridge: [Object] } } }

function CheckContainers(){
        
        apps.forEach(function(entry){
              entry.seen = false;
              });
	docker.listContainers(function (err, containers) {
            if (err) console.log(util.inspect(err));
            if (containers == null) return;
            containers.forEach(function (containerInfo) {
              theapp = apps.find(o => o.id === containerInfo.Id);
	message = {};
        a = [];
              if (!theapp){
                 o = {};
                 o.id = containerInfo.Id;
                 o.name    = containerInfo.Names[0];
                 o.hostname = o.name.substr(1);
                 o.ports   = containerInfo.Ports;
                 o.seen    = 1;
                 o.ip      = myIP;
                 apps.push(o);
		 WriteHaProxyConfig();
                 console.log("Found new container " + o.hostname);
                 add_host_name(o.hostname,o.ip);
                 } else {
                 theapp.seen = true;
                 }
  	      });
            });
        // Handle case where containers are gone
}


CheckContainers();
setInterval(CheckContainers, 5000);


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


server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});

