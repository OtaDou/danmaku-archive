import fs from "fs"
import YAML from "yaml"

const HISTORY_PATH = "history.yml"

// Windows reserved filenames
const REG_WINDOWS_RESERVED_FILENAME = /^(?=CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]$)/i
// Windows & Linux may have issues with some characters in filenames; dots can also confuse
// non-technical users when mixed with extensions. Normalize them away.
const REG_FILENAME_UNHAPPY_CHARACTERS = /^[\s.-]+|[<>:"/\\|?*]|[.]|[/;#]|[\s.]+$/g

export function readHistory(series) {
  const text = String(fs.readFileSync(HISTORY_PATH))
  const index = YAML.parse(text)
  return (index && index[series]) || []
}

export function addRecord(series, title, url) {
  const text = String(fs.readFileSync(HISTORY_PATH))
  const index = YAML.parse(text) || {}
  const episodes = index[series] || []
  episodes.push({ title, url })
  index[series] = episodes
  fs.writeFileSync(HISTORY_PATH, YAML.stringify(index))
}

export function saveFile(dir, fileName, extension, data) {
  const safeName = fileName
    .replace(REG_FILENAME_UNHAPPY_CHARACTERS, "_")
    .replace(REG_WINDOWS_RESERVED_FILENAME, "_")

  const payload = typeof data === "string" ? data : JSON.stringify(data)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const ext = extension && extension[0] !== "." ? `.${extension}` : extension || ""
  fs.writeFileSync(dir + safeName + ext, payload)
  return safeName
}
