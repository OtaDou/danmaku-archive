#!/usr/bin/bash

sudo apt update
sudo apt install 7zip -y

rm archive.7z
rm -rf ./dist ./archive
mkdir -p dist archive
branches=$(git branch -r | grep origin/20 | sed 's/origin\///g')

for season in $branches; do
    git checkout "origin/$season" archive/
    mv archive/* dist/
done

cd dist && 7z a -t7z ../archive.7z ./* && cd ..
ls -lh archive.7z