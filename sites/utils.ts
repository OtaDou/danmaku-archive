import fs from "fs"

const HISTORY_PATH = "HISTORY.csv"

// Windows reversed filenames
const regWindowsReservedFilename = /^(?=CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]$)/i
// Windows dislike some characters in filename;
// Linux user may getting trouble with certain characters in filename;
// Some user cannot understand dot in a filename which is ambiguous with file extension name;
// Let us remove these characters to make everyone happier
const regFilenameUnhappyCharacters = /^[\s.-]+|[<>:"/\\|?*]|[.]|[/;#]|[\s.]+$/g

export function readHistoryRecord() {
  const text = String(fs.readFileSync(HISTORY_PATH))
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((it) => it.split(","))
}

export function readHistoryUrl() {
  return readHistoryRecord().map((it) => it[it.length - 1])
}

export function addRecord(series = "NO_SERIES", ...args) {
  const weekMark = ["日", "月", "火", "水", "木", "金", "土"]
  if (args[args.length - 1].indexOf("http") === -1) {
    console.warn("WARN: last arg is not url, skip")
    return
  }
  const date = new Date()
  const todayMark = weekMark[date.getDay()]
  const offset = date.getTimezoneOffset()
  const formattedDate = new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .split("T")[0]
  const text = String(fs.readFileSync(HISTORY_PATH))
  const newLine = `${series},${formattedDate}(${todayMark}),${args.join(",")}`
  fs.writeFileSync(HISTORY_PATH, newLine + "\n" + text)
  return newLine
}

export function saveFile(dir, fileName, extension, data) {
  fileName = fileName
    .replace(regFilenameUnhappyCharacters, "_")
    .replace(regWindowsReservedFilename, "_")
  if (typeof data !== "string") data = JSON.stringify(data)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (extension && extension[0] !== ".") extension = "." + extension
  fs.writeFileSync(dir + fileName + extension, data)
  return fileName
}

/** @type {ExtOption} */
export const defaultOptions = {
  resolutionX: 560,
  resolutionY: 420,
  bottomReserved: 60,
  fontFamily: "Microsoft YaHei",
  fontSize: 1,
  textSpace: 0,
  rtlDuration: 8,
  fixDuration: 4,
  maxDelay: 6,
  textOpacity: 60,
  maxOverlap: 1,
}
