export myIP=$(ip route get 1 | awk '{print $NF;exit}')
echo $myIP
node svcrouter.js
