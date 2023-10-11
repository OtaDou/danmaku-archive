import fs from "fs"
import YAML from "yaml"

const HISTORY_PATH = "history.yml"

// Windows reversed filenames
const regWindowsReservedFilename = /^(?=CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]$)/i
// Windows dislike some characters in filename;
// Linux user may getting trouble with certain characters in filename;
// Some user cannot understand dot in a filename which is ambiguous with file extension name;
// Let us remove these characters to make everyone happier
const regFilenameUnhappyCharacters = /^[\s.-]+|[<>:"/\\|?*]|[.]|[/;#]|[\s.]+$/g

export function readHistory(series) {
  const text = String(fs.readFileSync(HISTORY_PATH))
  const index = YAML.parse(text)
  return index?.[series] ?? []
}

export function addRecord(series, title, url) {
  const text = String(fs.readFileSync(HISTORY_PATH))
  const index = YAML.parse(text) ?? {}
  let episodes = index?.[series] ?? []
  episodes.push({ title, url })
  index[series] = episodes
  fs.writeFileSync(HISTORY_PATH, YAML.stringify(index))
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
