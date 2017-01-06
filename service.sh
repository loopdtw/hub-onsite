#!/bin/bash

#set -x #echo on

RUN_ACTION=${1}

if [ "$#" == 0 ]; then
   echo "Please specify runtime action: [start], [stop], [logs]"
   exit 0
fi

if [ ${RUN_ACTION} == "start" ]; then
    yes | cp -rf ./service/loopd-hub-registration.service /etc/systemd/system/
    systemctl enable loopd-hub-registration
    systemctl start loopd-hub-registration
elif [ ${RUN_ACTION} == "stop" ]; then
    systemctl disable loopd-hub-registration
    systemctl stop loopd-hub-registration
elif [ ${RUN_ACTION} == "logs" ]; then
    journalctl -f
fi
