import fs from "fs"

/**
 * this script process HISTORY reocrds to readable ReadMe markdown file.
 * example: node history2md.js <branch-name> <history-file>(default HISTORY.csv) <output>(default index.md)
 */

const info = {
  repo: "https://github.com/OtaDou/ass-danmaku-store",
}

const branchName = process.argv[2]
const historyFilePath = process.argv[3] ?? "HISTORY.csv"
const outputFile = process.argv[4] ?? "index.md"
if (!branchName) cmdError()

function main() {
  const series = groupHistoryRecordByTime()
  genMarkdown(series)
}
main()

function groupHistoryRecordByTime() {
  const text = String(fs.readFileSync(historyFilePath))
  const lines = text.split("\n").filter((it) => it.trim() !== "")
  const records = lines
    .map((l) => {
      const [link, time, series, filePath] = l.split(",")
      return { link, time, series, filePath }
    })
    .sort((a, b) => a.time - b.time)
  return records.reduce((groups, item) => {
    const group = groups[item.series] || []
    group.push(item)
    groups[item.series] = group
    return groups
  }, {})
}

function genMarkdown(series) {
  const keys = Object.keys(series)
  const md = `
# ${branchName}

${keys.map((k) => seriesBlock(k, series[k])).join("\n")}

## Download archive
<${info.repo}/archive/refs/heads/${branchName}.zip>
`

  fs.writeFileSync(outputFile, md)
}

function seriesBlock(seriesName, records) {
  return `## ${seriesName}
| Title | Time | Resource |
| ----- | ----- | ----- |
${records.map((r) => episodeLine(r.time, r.filePath)).join("\n")}
  `
}

function episodeLine(time, filePath) {
  time = new Date(Number(time)).toISOString().slice(0, 10)
  const shortFileName = filePath.split("/").reverse()[0]
  return `| ${shortFileName} | ${time} | ${anchor("ass", `${filePath}.ass`)} |`
}

function anchor(text, link) {
  return `<a href="${encodeURIComponent(link)}">${text}</a>`
}
function cmdError() {
  console.error(
    `command error
sytax: node history2md.js <branch-name> <history-file>(default HISTORY.csv) <output>(default index.md)
`
  )
  process.exit(-1)
}
