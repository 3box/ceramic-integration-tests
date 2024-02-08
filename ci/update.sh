#!/bin/bash

set -ex

deps=$(jq -r '.dependencies | keys | .[]' package.json)
filtered_deps=''
for dep in $deps
do
    # Look for specific deps we manage
    case $dep in
        "dids" | "key-did-provider-ed25519" | "key-did-resolver")
            filtered_deps="$filtered_deps $dep@latest"
            continue
            ;;
        *)
            # Ignore other deps
            ;;
    esac
    scope=$(dirname "$dep")
    case $scope in
        "@ceramicnetwork"|"@composedb")
            filtered_deps="$filtered_deps $dep@nightly"
            ;;
        *)
            # Ignore other deps
            ;;
    esac
done

npm install --ignore-scripts $filtered_deps

npm run postinstall -prefix ./node_modules/go-ipfs
npm rebuild bcrypto
npm rebuild loady
npm rebuild node-jq
npm rebuild sqlite3

npm run build

echo "Updated versions of dependencies:"
jq -r '.dependencies' package.json
