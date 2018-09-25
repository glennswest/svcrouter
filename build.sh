docker build -t svcrouter .
docker tag svcrouter ${SVCHOST}:5000/svcrouter
docker push ${SVCHOST}:5000/svcrouter

