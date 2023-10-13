#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
const HISTORY_PATH = path.join(process.cwd(), "history.yml")

const text = String(fs.readFileSync(HISTORY_PATH))
const index = YAML.parse(text) ?? {}
const DEFAULT_OUTPUT = "ReadMe.md"
const REPO_URL = "https://github.com/OtaDou/danmaku-archive"

function indexOverview(seasonName) {
  return `<details>\n\t<summary>${seasonName} <a href="${REPO_URL}/archive/refs/heads/${seasonName}.zip">zip</a></summary>\n
${historyToTable()}
</details>
`
}
function titledTable(seasonName) {
  return `# ${seasonName}
${historyToTable()}

### Download [${seasonName}.zip](${REPO_URL}/archive/refs/heads/${seasonName}.zip)`
}

function historyToTable() {
  return (
    `| NAME | EPISODE |\n| --- | --- |\n` +
    Object.keys(index)
      .map((title) => `| ${title} | ${index[title].length} |`)
      .join("\n")
  )
}

if (process.argv.length < 3) {
  console.log("USAGE: history2md.mjs <seasonName> [--compact]")
  process.exit(0)
}

const seasonName = process.argv[2]
const compact = process.argv.includes("--compact")

if (compact) {
  const content = indexOverview(seasonName)
  fs.appendFileSync(DEFAULT_OUTPUT, content)
} else {
  const content = titledTable(seasonName)
  fs.writeFileSync(DEFAULT_OUTPUT, content)
}
