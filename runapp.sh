docker kill svcatomsite.site.com
docker rm svcatomsite.site.com
docker run --net=host -d -p 80 --name svcatomsite.site.com -v /var/run/docker.sock:/var/run/docker.sock svcatomsite

