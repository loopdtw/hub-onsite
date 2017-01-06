#!/bin/bash

set -x #echo on

if [ ! -d node_modules ]; then
	mkdir node_modules
	tar -czvf node_modules_edison.tar.gz ./node_modules
fi

/usr/bin/git pull
/usr/bin/npm run edison:production