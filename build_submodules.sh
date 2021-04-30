#!/bin/sh
cd ./src/submodules/js-ceramic
npm install
cd ./packages/ipfs-daemon
npm install
npm run build
