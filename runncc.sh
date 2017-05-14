docker kill svcrouter.ncc9.com
docker rm svcrouter.ncc9.com
docker run --net=host -p 8080 -d --privileged --name svcrouter.ncc9.com -v /var/run/docker.sock:/var/run/docker.sock svcrouter

