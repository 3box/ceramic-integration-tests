#!/bin/sh
cd ./src/submodules/js-ceramic
npm install
cd ./packages/ipfs-daemon
npm run build
