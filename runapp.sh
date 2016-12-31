docker kill svcrouter.site.com
docker rm svcrouter.site.com
docker run --net=host -d --publish-all --privileged --name svcrouter.site.com -v /var/run/docker.sock:/var/run/docker.sock svcrouter

