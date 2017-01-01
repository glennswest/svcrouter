docker kill svcrouter.site.com
docker rm svcrouter.site.com
docker run --net=host -p 8080 -d --privileged --name svcrouter.site.com -v /var/run/docker.sock:/var/run/docker.sock svcrouter

