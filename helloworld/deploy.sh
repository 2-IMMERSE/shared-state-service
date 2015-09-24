#!/bin/bash
Folder=./shared-state

##### check name of node.js
nodeCommand=node
if [ -f /usr/bin/nodejs ]; then
	nodeCommand=nodejs
fi
#####

if [ ! -d $Folder  ];
then
	echo "Cloning repository..."
	git clone https://github.com/mediascape/shared-state
else
	echo "Checking for updates..."
	cd $Folder
	git pull
	cd ..
fi

if [ -d deploy/ ]; then
    if [ -d deploy/node_modules/ ]; then
        mkdir temp/
		mkdir temp/node_modules/
        mv deploy/node_modules/* temp/node_modules/
    fi
	rm -r deploy/
fi

mkdir deploy
echo "Copy needed files from repository..."
cp -R $Folder/Server/* deploy/
cp -R $Folder/helloworld/* deploy/www/
rm deploy/www/deploy.sh
mkdir deploy/www/js/
cp -R $Folder/API/* deploy/www/js/

if [ -d temp/node_modules/ ]; then
	mkdir deploy/node_modules/
    mv temp/node_modules/* deploy/node_modules/
    rm -r temp/
fi

cd deploy/
echo "Starting setup Script..."
$nodeCommand setup.js
echo "Installing dependencies..."
npm install
echo "Start the Node.js Server..."
$nodeCommand index.js