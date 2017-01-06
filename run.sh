#!/bin/bash

set -x #echo on

/usr/sbin/rfkill block bluetooth
sleep 2
/usr/sbin/rfkill unblock bluetooth
sleep 2
/usr/bin/hciconfig hci0 up
cd /home/root/loopd-hub-registration/.
/usr/bin/git pull
/usr/bin/npm run edison:production