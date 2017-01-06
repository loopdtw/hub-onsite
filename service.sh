#!/bin/bash

set -x #echo on

RUN_ACTION=${1}

if [ ${RUN_ACTION} == "start" ]; then
    cp ./loopd-hub-registration.service /etc/systemd/system/
    systemctl enable loopd-hub-registration
    systemctl start loopd-hub-registration
else if [ ${RUN_ACTION} == "stop" ]; then
    systemctl disable loopdhubclient
    systemctl stop loopdhubclient
else if [ ${RUN_ACTION} == "logs" ]; then
    journalctl -f
fi