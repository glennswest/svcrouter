docker build -t svcrouter .
docker tag svcrouter s001.site.com:5000/svcrouter
docker push s001.site.com:5000/svcrouter

