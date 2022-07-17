// @ts-check
import font from "./font.js"

const predefFontFamily = () => {
  const sc = ["Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC"]
  const tc = ["Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC"]
  const ja = ["MS PGothic", "Hiragino Kaku Gothic Pro", "Noto Sans CJK JP"]
  const lang = globalThis?.navigator?.language ?? "sc"
  const fonts = /^ja/.test(lang)
    ? ja
    : /^zh(?!.*Hans).*(?:TW|HK|MO)/.test(lang)
    ? tc
    : sc
  const chosed = fonts.find((f) => font.valid(f)) || fonts[0]
  return chosed
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
