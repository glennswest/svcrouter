require('log-timestamp')(function() { return new Date().toString() + ' %s' });
var fssync = require('fs-sync');
var fs = require('fs');
var util=require('util');
var process=require('process');
var execFile=require('child_process').execFile;
var restify = require('restify');
var mqtt = require('mqtt')
var uuid = require('uuid/v4');
var myuuid = uuid();
var haproxy_pid = 0;

Docker = require('dockerode');
docker = new Docker();

apps = [];
xapps = [];

update_needed = false;

sitename = "";
dhostname = "";
lhostname = "";
ghostname = "";

myIP = process.env.myIP;
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
                          register_xapps();
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
       xapps.forEach(function(entry){
          e = {};
          e.name = entry.name + '.';
          e.zone = entry.zone + '.';
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
           console.log("HaProxy Restart Needed: " + data);
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
               console.log("hostname = " + hostname + "name = " + name);
               line = '    acl host_' + name + ' hdr(host) -i ' + hostname + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               line = '    use_backend ' + name + '_cluster if host_' + name + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               }
            });
        xapps.forEach(function(entry){
               hostname = entry.name;
               name = hostname.replace(/\./gi,'_');
               console.log("hostname = " + hostname + "name = " + name);
               line = '    acl host_' + name + ' hdr(host) -i ' + hostname + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               line = '    use_backend ' + name + '_cluster if host_' + name + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
            });
        theport = 0;
        apps.forEach(function(entry){
            if (entry.ports.length > 0){
               hostname = entry.name.slice(1);
               name = hostname.replace(/\./gi,'_');
               console.log("hostname = " + hostname + "name = " + name);
               line = 'backend ' + name + '_cluster' + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    balance roundrobin\n');
               //fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpchk get /check\n');
               //fs.appendFileSync('/etc/haproxy/haproxy.cfg','    http-check expect status 200\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpclose\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option forwardfor\n');
               entry.ports.forEach(function(portentry){
                      console.log("Port Entry = " + util.inspect(portentry));
                      if (theport == 0){
                         theport = portentry.PublicPort;
                        } else {
                        if (portentry.PrivatePort < theport){
                          theport = portentry.PublicPort;
                          }
                        }
                      });
               console.log("Port = " + theport);
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    server node1 127.0.0.1:' + theport + ' maxconn 32\n');
               }
            });
        xapps.forEach(function(entry){
               hostname = entry.name;
               name = hostname.replace(/\./gi,'_');
               console.log("hostname = " + hostname + "name = " + name);
               line = 'backend ' + name + '_cluster' + '\n';
               fs.appendFileSync('/etc/haproxy/haproxy.cfg',line);
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    balance roundrobin\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpchk get /check\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    http-check expect status 200\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option httpclose\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    option forwardfor\n');
               fs.appendFileSync('/etc/haproxy/haproxy.cfg','    server node1 ' + entry.ip + ':' + entry.port + ' maxconn 32\n');
            });
        fs.appendFileSync('/etc/haproxy/haproxy.cfg','\n');
        reread_haproxy();
}

//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) Updating HaProxyConfig
//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) hostname = wlab.app.ctl.k.e2e.bos.redhat.comname = wlab_app_ctl_k_e2e_bos_redhat_com
//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) hostname = wlab.app.ctl.k.e2e.bos.redhat.comname = wlab_app_ctl_k_e2e_bos_redhat_com
//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) Port Entry = { IP: '0.0.0.0',
  //PrivatePort: 8085,
  //PublicPort: 32769,
  //Type: 'tcp' }
//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) Port Entry = { PrivatePort: 8080, Type: 'tcp' }
//Tue Sep 25 2018 18:20:12 GMT+0800 (SGT) Port = undefined

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
//
//      "Config": {
//            "Hostname": "s001",
//            "Domainname": "site.com",
//            "User": "",
//            "AttachStdin": false,
//            "AttachStdout": false,
//            "AttachStderr": false,
//            "ExposedPorts": {
//                "8080/tcp": {}
//            },

function FindTheContainer(thename)
{
var thefoundone = null;
var thefoundidx = null;

        apps.forEach(function(entry,idx){
             if (entry.name.valueOf() === thename.valueOf()){
                thefoundone = entry;
                thefoundidx = idx;
                }
             });
        return thefoundidx;
}

function process_new_container(tc)
{
     var o = {};
     o.id = tc.Id;
     o.name    = tc.Names[0];
     container = docker.getContainer(o.id);
     container.inspect(function(err,data){
        o.exposed_ports = data.Config.ExposedPorts;
        });
     o.hostname = o.name.substr(1);
     o.ports   = tc.Ports;
     o.seen    = true;
     o.ip      = myIP;
     apps.push(o);
     update_needed = true;
     add_host_name(o.hostname,o.ip);


}
function ClearSeenFlag()
{
        apps.forEach(function(element,idx){
             apps[idx].seen = false;
             });

}

function CheckContainers(){
        
	docker.listContainers(function (err, containers) {
            if (err){
                console.log("ERROR Listing Containers");
                console.log(util.inspect(err));
                return;
                }
            if (containers == null) return;
            containers.forEach(function (containerInfo) {
              theappidx = FindTheContainer(containerInfo.Names[0]);
              if (theappidx === null){
                 process_new_container(containerInfo);
                 } else {
                 apps[theappidx].seen = true;
                 }
  	      });
            });
        
         apps.forEach(function(entry,index){
              if (entry.seen === false){
                 console.log("Removing container " + entry.hostname);
                 update_needed = true;
                 apps.splice(index,1);
                 }
              });
        
        if (update_needed == true){
		 WriteHaProxyConfig();
		 update_needed = false;
                 }
}

function get_domain(name){
        console.log("get_domain: " + name);
	namearray = name.split(".");
	namearray.shift();
	domain = namearray.join('.');
	return(domain);
}

function add_xapps(name,zone,ip,port){
	x = {};
	x.name = name;
	x.zone = zone;
	x.ip   = ip;
        x.port = port;
        add_host_name(x.name,x.ip);
	xapps.push(x);
}

function register_xapps(){
	info = docker.info(function(err, info){
                  dhostname = info.Name;
                  sitename = get_domain(dhostname);
                  lhostname = "svcrouter." + dhostname;
                  console.log("Xhosts");
                  console.log("sitename = " + sitename);
                  console.log("dhostname = " + dhostname);
		  //add_xapps(lhostname,dhostname,myIP,8080);
		  add_xapps(dhostname,sitename,myIP,8080);  // Register The Host Itself
                  ghostname = "svcrouter." + sitename;
		  add_xapps(ghostname,sitename,myIP,8080);
                  });
}


//register_xapps();


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

