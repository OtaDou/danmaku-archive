#!/usr/bin/env node
import fs from "node:fs";
import YAML from "yaml";

const branch = process.argv.find(a => !a.includes('/') && !a.startsWith('-')) 
  || (console.log(`Detected branch: ${fs.readFileSync(".git/HEAD", "utf-8").split('/').pop().trim()}`), fs.readFileSync(".git/HEAD", "utf-8").split('/').pop().trim());

const isCompact = process.argv.includes("--compact");
const index = YAML.parse(fs.readFileSync("history.yml", "utf8")) || {};
const zipUrl = `https://github.com/OtaDou/danmaku-archive/archive/refs/heads/${branch}.zip`;

const table = `| NAME | EPISODE |\n| --- | --- |\n` + 
  Object.entries(index).map(([k, v]) => `| ${k} | ${v.length} |`).join("\n");

const out = isCompact 
  ? `<details>\n<summary>${branch} <a href="${zipUrl}">zip</a></summary>\n\n${table}\n</details>\n`
  : `# ${branch}\n${table}\n\n### Download [${branch}.zip](${zipUrl})`;

fs[isCompact ? "appendFileSync" : "writeFileSync"]("ReadMe.md", out);