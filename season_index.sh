#!/bin/sh

# get array of all remote origin branch named starts with "20"
branches=$(git branch -r | grep origin/20 | sed 's/origin\///g')

mv history.yml history.bak
chmod +x ./history2md.mjs

# for all season checkout history.yml then run history2md.mjs <branchName> --compact
for season in $branches; do
    git checkout "origin/$season" history.yml
    ./history2md.mjs "$season" --compact
done

mv history.bak history.yml
