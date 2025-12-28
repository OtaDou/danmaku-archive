#!/usr/bin/bash

npm i yaml
branches=$(git branch -r | grep origin/20 | sed 's/origin\///g')

chmod +x ./history2md.mjs

for season in $branches; do
    git checkout "origin/$season" history.yml
    ./history2md.mjs "$season" --compact
done

rm history.yml
