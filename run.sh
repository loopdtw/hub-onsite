#!/bin/bash

set -x #echo on

/usr/sbin/rfkill unblock bluetooth
sleep 2
cd /home/root/badge-state-viewer
/usr/bin/git pull
/usr/bin/npm run edison:production