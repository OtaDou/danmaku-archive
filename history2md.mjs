#!/usr/bin/env node
import fs from "node:fs";
import YAML from "yaml";

const args = process.argv.slice(2).filter(a => !a.startsWith("-"));
const isCompact = process.argv.includes("--compact");

const branch = args[0] || fs.readFileSync(".git/HEAD", "utf-8").split('/').pop().trim();
console.log(`Working on branch: ${branch}`);

const index = YAML.parse(fs.readFileSync("history.yml", "utf-8")) || {};
const url = `https://github.com/OtaDou/danmaku-archive/archive/refs/heads/${branch}.zip`;
const table = `| NAME | EPISODE |\n| --- | --- |\n${Object.entries(index).map(([k, v]) => `| ${k} | ${v.length} |`).join("\n")}`;

const out = isCompact 
  ? `<details>\n<summary>${branch} <a href="${url}">zip</a></summary>\n\n${table}\n</details>\n`
  : `# ${branch}\n${table}\n\n### Download [${branch}.zip](${url})`;

fs[isCompact ? "appendFileSync" : "writeFileSync"]("ReadMe.md", out);