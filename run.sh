docker kill svcrouter.${SVCDOMAIN}
docker rm svcrouter.${SVCDOMAIN}
docker run --net=host -p 8080 -d --privileged --name svcrouter.${SVCDOMAIN} -v /var/run/docker.sock:/var/run/docker.sock svcrouter

