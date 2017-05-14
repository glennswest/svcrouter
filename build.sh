docker build -t svcrouter .
docker tag svcrouter ctl.ncc9.com:5000/svcrouter
docker push ctl.ncc9.com:5000/svcrouter

