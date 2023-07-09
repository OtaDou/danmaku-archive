#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const defaultOptions = {
  resolutionX: 854,
  resolutionY: 480,
  bottomReserved: 60,
  fontFamily: "Microsoft YaHei",
  fontSize: 1.3,
  textSpace: 0,
  rtlDuration: 8,
  fixDuration: 4,
  maxDelay: 1,
  textOpacity: 80,
  maxOverlap: 1,
  offsetMs: 0,
}

function decodeXmlEntities(s) {
  if (!s) return ""
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16))
    )
}

function stripBom(s) {
  return typeof s === "string" && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function tryJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const font = {
  get text() {
    if (typeof document === "undefined") {
      return (fontname, text, size) => size * text.length
    }
    if (/linux/i.test(navigator.platform)) {
      return this.textByDom()
    } else {
      return this.textByCanvas()
    }
  },

  get valid() {
    const cache = new Map()
    const textWidth = this.text
    const sampleText = [
      "The quick brown fox jumps over the lazy dog",
      "7531902468",
      ",.!-",
      "，。：！",
      "天地玄黄",
      "則近道矣",
      "あいうえお",
      "アイウエオガパ",
      "ｱｲｳｴｵｶﾞﾊﾟ",
    ].join("")
    const sampleFont = [
      "monospace",
      "sans-serif",
      "sans",
      "Symbol",
      "Arial",
      "Comic Sans MS",
      "Fixed",
      "Terminal",
      "Times",
      "Times New Roman",
      "SimSum",
      "Microsoft YaHei",
      "PingFang SC",
      "Heiti SC",
      "WenQuanYi Micro Hei",
      "Pmingliu",
      "Microsoft JhengHei",
      "PingFang TC",
      "Heiti TC",
      "MS Gothic",
      "Meiryo",
      "Hiragino Kaku Gothic Pro",
      "Hiragino Mincho Pro",
    ]
    const diffFont = function (base, test) {
      const baseSize = textWidth(base, sampleText, 72)
      const testSize = textWidth(test + "," + base, sampleText, 72)
      return baseSize !== testSize
    }
    const validFont = function (test) {
      if (cache.has(test)) return cache.get(test)
      const result = sampleFont.some((base) => diffFont(base, test))
      cache.set(test, result)
      return result
    }
    return validFont
  },

  textByCanvas() {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    return function (fontname, text, fontsize) {
      context.font = `bold ${fontsize}px ${fontname}`
      return Math.ceil(context.measureText(text).width)
    }
  },
  textByDom() {
    const container = document.createElement("div")
    container.setAttribute("style", "all: initial !important")
    const content = document.createElement("div")
    content.setAttribute(
      "style",
      [
        "top: -10000px",
        "left: -10000px",
        "width: auto",
        "height: auto",
        "position: absolute",
      ]
        .map((item) => item + " !important;")
        .join(" ")
    )
    const active = () => {
      document.body.parentNode.appendChild(content)
    }
    if (!document.body) document.addEventListener("DOMContentLoaded", active)
    else active()
    return (fontname, text, fontsize) => {
      content.textContent = text
      content.style.font = `bold ${fontsize}px ${fontname}`
      return content.clientWidth
    }
  },
}

export const parser = {
  danmakuFilter(danmaku) {
    if (!danmaku) return false
    if (!danmaku.text) return false
    if (!danmaku.mode) return false
    if (!danmaku.size) return false
    if (danmaku.time < 0 || danmaku.time >= 360000) return false
    return true
  },
  parseRgb256IntegerColor(color) {
    const rgb = parseInt(color, 10)
    const r = (rgb >>> 4) & 0xff
    const g = (rgb >>> 2) & 0xff
    const b = (rgb >>> 0) & 0xff
    return { r, g, b }
  },
  parseNiconicoColor(mail) {
    const colorTable = {
      red: { r: 255, g: 0, b: 0 },
      pink: { r: 255, g: 128, b: 128 },
      orange: { r: 255, g: 184, b: 0 },
      yellow: { r: 255, g: 255, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      cyan: { r: 0, g: 255, b: 255 },
      blue: { r: 0, g: 0, b: 255 },
      purple: { r: 184, g: 0, b: 255 },
      black: { r: 0, g: 0, b: 0 },
    }
    const defaultColor = { r: 255, g: 255, b: 255 }
    const line = mail.toLowerCase().split(/\s+/)
    const color = Object.keys(colorTable).find((color) => line.includes(color))
    return color ? colorTable[color] : defaultColor
  },
  parseHexColor(color) {
    const hex = color
      .replace(/[^0-9A-Za-z]/g, "")
      .replace(/^(.) (.) (.)$/, "$0$0$1$1$2$2")
    const [r, g, b] = hex
      .split(/(?=(?:..)*$)/)
      .map((v) => Number.parseInt(v, 16))
    return { r, g, b }
  },
  parseNiconicoMode(mail) {
    const line = mail.toLowerCase().split(/\s+/)
    if (line.includes("ue")) return "TOP"
    if (line.includes("shita")) return "BOTTOM"
    return "RTL"
  },
  parseNiconicoSize(mail) {
    const line = mail.toLowerCase().split(/\s+/)
    if (line.includes("big")) return 36
    if (line.includes("small")) return 16
    return 25
  },
  bilibili_xml(content) {
    const text = stripBom(
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    )
    const clean = text.replace(
      /(?:[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g,
      ""
    )
    const cidMatch = /<chatid>(\d+)<\/chatid>/i.exec(clean)
    const cid = cidMatch ? +cidMatch[1] : NaN
    const danmaku = []
    const re = /<d\b[^>]*\bp="([^"]+)"[^>]*>([\s\S]*?)<\/d>/gi
    let m
    while ((m = re.exec(clean))) {
      const p = m[1]
      const body = decodeXmlEntities(m[2] ?? "")
      const [time, mode, size, color, create, bottom, sender, id] = p.split(",")
      danmaku.push({
        text: body,
        time: +time,
        mode: [null, "RTL", "RTL", "RTL", "BOTTOM", "TOP"][+mode],
        size: +size,
        color: this.parseRgb256IntegerColor(color),
        bottom: bottom > 0,
      })
    }
    return { cid, danmaku: danmaku.filter(this.danmakuFilter) }
  },
  acfun_v4(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const data = JSON.parse(text)
    const list = data.reduce((x, y) => x.concat(y), [])
    const danmaku = list
      .map((line) => {
        const [time, color, mode, size, sender, create, uuid] = line.c.split(",")
        const text = line.m
        return {
          text,
          time: +time,
          color: this.parseRgb256IntegerColor(+color),
          mode: [null, "RTL", null, null, "BOTTOM", "TOP"][mode],
          size: +size,
          bottom: false,
          uuid,
        }
      })
      .filter(this.danmakuFilter)
    return { danmaku }
  },
  acfun_poll(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const data = JSON.parse(text)
    const danmaku = data.added
      .map((danmu) => {
        const { position, color, mode, size, body, danmakuId } = danmu
        return {
          text: body,
          time: position / 1000,
          color: this.parseRgb256IntegerColor(+color),
          mode: [null, "RTL", null, null, "BOTTOM", "TOP"][mode],
          size: +size,
          bottom: false,
          danmuId: danmakuId,
        }
      })
      .filter(this.danmakuFilter)
    return { danmaku }
  },
  acfun(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const data = JSON.parse(text)
    const danmaku = data.danmakus
      .map((danmaku) => {
        const { position, color, mode, size, body, danmakuId } = danmaku
        return {
          text: body,
          time: position / 1000,
          color: this.parseRgb256IntegerColor(+color),
          mode: [null, "RTL", null, null, "BOTTOM", "TOP"][mode],
          size: +size,
          bottom: false,
          danmuId: danmakuId,
        }
      })
      .filter(this.danmakuFilter)
    return { danmaku }
  },
  niconico(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const mainJson = JSON.parse(text)
    const threads = mainJson?.data?.threads ?? []
    const globalComments = mainJson?.data?.globalComments ?? []

    const bestGlobal = globalComments.reduce(
      (best, cur) => ((cur?.count ?? 0) > (best?.count ?? 0) ? cur : best),
      null
    )
    const thread = bestGlobal?.id ?? threads?.[0]?.id

    let list = []
    threads.forEach((t) => {
      if (!t || !Array.isArray(t.comments) || t.comments.length === 0) return
      list = list.concat(t.comments)
    })

    const seen = new Set()
    const danmaku = list
      .map((comment) => {
        if (!comment || !comment.body || !comment.no) return null
        const vposMs =
          comment.vposMs ?? (comment.vpos != null ? Number(comment.vpos) * 10 : null)
        if (!(vposMs >= 0)) return null
        const uniqId = comment.id ?? comment.no
        if (seen.has(uniqId)) return null
        seen.add(uniqId)
        const commands = Array.isArray(comment.commands) ? comment.commands : []
        const commandString = commands.join(" ")
        return {
          text: comment.body,
          time: vposMs / 1000,
          color: this.parseNiconicoColor(commandString),
          mode: this.parseNiconicoMode(commandString),
          size: this.parseNiconicoSize(commandString),
          bottom: false,
          id: uniqId,
        }
      })
      .filter(this.danmakuFilter)
    return { thread, danmaku }
  },
  bahamut(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const list = JSON.parse(text)
    const danmaku = list
      .map((comment) => {
        if (!comment) return null
        const { text, time, color, position, size } = comment
        if (!text) return null
        if (comment.position < 0 || comment.position > 2) return null
        if (comment.size < 0 || comment.size > 2) return null
        return {
          text,
          time: time / 10,
          color: this.parseHexColor(color),
          mode: ["RTL", "TOP", "BOTTOM"][position],
          size: [16, 24, 28][size],
          bottom: false,
        }
      })
      .filter(this.danmakuFilter)
    return { danmaku }
  },
  himawari(content) {
    const text = stripBom(
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    )
    const danmaku = []
    const re1 = /<c\b(?![^>]*\bdeleted\b)[^>]*\bp="([^"]+)"[^>]*>([\s\S]*?)<\/c>/gi
    let m1
    while ((m1 = re1.exec(text))) {
      const p = m1[1]
      const [vpos] = p.split(",")
      danmaku.push({
        text: decodeXmlEntities(m1[2] ?? ""),
        time: Number.parseInt(vpos, 36) / 100,
        mode: "RTL",
        size: 24,
        color: { r: 255, g: 255, b: 255 },
        bottom: false,
      })
    }
    const re2 = /<chat\b(?![^>]*\bdeleted\b)[^>]*\bvpos="([^"]+)"[^>]*>([\s\S]*?)<\/chat>/gi
    let m2
    while ((m2 = re2.exec(text))) {
      const vpos = m2[1]
      danmaku.push({
        text: decodeXmlEntities(m2[2] ?? ""),
        time: Number.parseInt(vpos, 36) / 100,
        mode: "RTL",
        size: 24,
        color: { r: 255, g: 255, b: 255 },
        bottom: false,
      })
    }
    return { danmaku: danmaku.filter(this.danmakuFilter) }
  },
}

export async function toLayout(danmaku, options) {
  const rtlCanvas = function (options) {
    const {
      resolutionX: wc,
      resolutionY: hc,
      bottomReserved: b,
      rtlDuration: u,
      maxDelay: maxr,
      rtlEnterRatio: enterRatio = 0,
      rtlTimeIsCenter: rtlTimeIsCenter = false,
    } = options
    const effectiveEnterRatio = rtlTimeIsCenter ? 0 : enterRatio

    let used = [
      { p: -Infinity, m: 0, tf: Infinity, td: Infinity, b: false },
      { p: hc, m: Infinity, tf: Infinity, td: Infinity, b: false },
      { p: hc - b, m: hc, tf: Infinity, td: Infinity, b: true },
    ]
    const available = (hv, t0s, t0l, b) => {
      const suggestion = []
      for (let idx = 0; idx < used.length; idx++) {
        const i = used[idx]
        if (i.m + hv >= hc) continue
        const p = i.m
        const m = p + hv
        let tas = t0s
        let tal = t0l
        for (let jdx = 0; jdx < used.length; jdx++) {
          const j = used[jdx]
          if (j.p >= m) continue
          if (j.m <= p) continue
          if (j.b && b) continue
          tas = Math.max(tas, j.tf)
          tal = Math.max(tal, j.td)
        }
        const r = Math.max(tas - t0s, tal - t0l)
        if (r > maxr) continue
        suggestion.push({ p, r })
      }
      suggestion.sort((x, y) => x.p - y.p)
      let mr = maxr
      const filtered = []
      for (let i = 0; i < suggestion.length; i++) {
        const item = suggestion[i]
        if (item.r >= mr) continue
        mr = item.r
        filtered.push(item)
      }
      return filtered
    }
    const use = (p, m, tf, td) => {
      used.push({ p, m, tf, td, b: false })
    }
    const syn = (t0s, t0l) => {
      used = used.filter((i) => i.tf > t0s || i.td > t0l)
    }
    const score = (i) => {
      if (i.r > maxr) return -Infinity
      return 1 - Math.hypot(i.r / maxr, i.p / hc) * Math.SQRT1_2
    }
    return (line) => {
      const { time: t0s, width: wv, height: hv, bottom: b } = line
      const enter = Math.max(0, Math.min(wv, wv * effectiveEnterRatio))
      const t0l = Math.max(0, (wc - enter) / (wv + wc)) * u + t0s
      syn(t0s, t0l)
      const al = available(hv, t0s, t0l, b)
      if (!al.length) return null
      let best = null
      let bestScore = -Infinity
      for (let i = 0; i < al.length; i++) {
        const candidate = al[i]
        const s = score(candidate)
        if (s > bestScore) {
          bestScore = s
          best = candidate
        }
      }
      if (!best) return null
      const ts = t0s + best.r
      const tf = Math.max(0, (wv - enter) / (wv + wc)) * u + ts
      const td = u + ts
      use(best.p, best.p + hv, tf, td)
      return { top: best.p, time: ts }
    }
  }

  const fixedCanvas = function (options) {
    const { resolutionY: hc, bottomReserved: b, fixDuration: u, maxDelay: maxr } =
      options
    let used = [
      { p: -Infinity, m: 0, td: Infinity, b: false },
      { p: hc, m: Infinity, td: Infinity, b: false },
      { p: hc - b, m: hc, td: Infinity, b: true },
    ]
    const fr = (p, m, t0s, b) => {
      let tas = t0s
      for (let idx = 0; idx < used.length; idx++) {
        const j = used[idx]
        if (j.p >= m) continue
        if (j.m <= p) continue
        if (j.b && b) continue
        tas = Math.max(tas, j.td)
      }
      const r = tas - t0s
      if (r > maxr) return null
      return { r, p, m }
    }
    const top = (hv, t0s, b) => {
      const suggestion = []
      for (let idx = 0; idx < used.length; idx++) {
        const i = used[idx]
        if (i.m + hv >= hc) continue
        const candidate = fr(i.m, i.m + hv, t0s, b)
        if (candidate) suggestion.push(candidate)
      }
      return suggestion
    }
    const bottom = (hv, t0s, b) => {
      const suggestion = []
      for (let idx = 0; idx < used.length; idx++) {
        const i = used[idx]
        if (i.p - hv <= 0) continue
        const candidate = fr(i.p - hv, i.p, t0s, b)
        if (candidate) suggestion.push(candidate)
      }
      return suggestion
    }
    const use = (p, m, td) => {
      used.push({ p, m, td, b: false })
    }
    const syn = (t0s) => {
      used = used.filter((i) => i.td > t0s)
    }
    const score = (i, is_top) => {
      if (i.r > maxr) return -Infinity
      const f = (p) => (is_top ? p : hc - p)
      return 1 - ((i.r / maxr) * (31 / 32) + (f(i.p) / hc) * (1 / 32))
    }
    return function (line) {
      const { time: t0s, height: hv, bottom: b } = line
      const is_top = line.mode === "TOP"
      syn(t0s)
      const al = (is_top ? top : bottom)(hv, t0s, b)
      if (!al.length) return null
      let best = null
      let bestScore = -Infinity
      for (let i = 0; i < al.length; i++) {
        const candidate = al[i]
        const s = score(candidate, is_top)
        if (s > bestScore) {
          bestScore = s
          best = candidate
        }
      }
      if (!best) return null
      use(best.p, best.m, best.r + t0s + u)
      return { top: best.p, time: best.r + t0s }
    }
  }

  const placeDanmaku = function (options) {
    const layers = options.maxOverlap
    const normal = Array(layers)
      .fill(null)
      .map(() => rtlCanvas(options))
    const fixed = Array(layers)
      .fill(null)
      .map(() => fixedCanvas(options))
    return function (line) {
      line.fontSize = Math.round(line.size * options.fontSize)
      line.height = line.fontSize
      line.width =
        line.width ||
        font.text(options.fontFamily, line.text, line.fontSize) ||
        1

      if (line.mode === "RTL" && options.rtlTimeIsCenter) {
        line.time = line.time - options.rtlDuration / 2
      }

      if (line.mode === "RTL") {
        let pos = null
        for (let i = 0; i < normal.length && !pos; i++) {
          pos = normal[i](line) || pos
        }
        if (!pos) return null
        const { top, time } = pos
        const enterRatio = options.rtlTimeIsCenter
          ? 0
          : (options.rtlEnterRatio ?? 0)
        const enter = Math.max(0, Math.min(line.width, line.width * enterRatio))
        let startTime = time
        const endTime = options.rtlDuration + time
        if (endTime <= 0) return null

        let startX = options.resolutionX + line.width / 2 - enter
        const endX = -line.width / 2
        if (startTime < 0) {
          const progress = Math.min(
            1,
            Math.max(0, (0 - startTime) / options.rtlDuration)
          )
          startX = startX + (endX - startX) * progress
          startTime = 0
        }
        if (endTime <= startTime) return null
        line.layout = {
          type: "Rtl",
          start: {
            x: startX,
            y: top + line.height,
            time: startTime,
          },
          end: {
            x: endX,
            y: top + line.height,
            time: endTime,
          },
        }
      } else if (line.mode === "TOP" || line.mode === "BOTTOM") {
        let pos = null
        for (let i = 0; i < fixed.length && !pos; i++) {
          pos = fixed[i](line) || pos
        }
        if (!pos) return null
        const { top, time } = pos
        let startTime = time
        const endTime = options.fixDuration + time
        if (endTime <= 0) return null
        if (startTime < 0) startTime = 0
        line.layout = {
          type: "Fix",
          start: {
            x: Math.round(options.resolutionX / 2),
            y: top + line.height,
            time: startTime,
          },
          end: {
            time: endTime,
          },
        }
      }
      return line
    }
  }

  async function arrange(danmaku, options) {
    const offsetMs = Number(options.offsetMs ?? 0)
    const offsetSec = Number.isFinite(offsetMs) ? offsetMs / 1000 : 0
    const sorted = danmaku
      .map((line) => ({
        ...line,
        time: (Number(line.time) || 0) + offsetSec,
      }))
      .sort(({ time: x }, { time: y }) => x - y)
    const place = placeDanmaku(options)
    const result = Array(sorted.length)
    let length = 0
    for (let i = 0, l = sorted.length; i < l; i++) {
      const placed = place(sorted[i])
      if (placed) result[length++] = placed
      if ((i + 1) % 1000 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    result.length = length
    result.sort((x, y) => x.layout.start.time - y.layout.start.time)
    return result
  }

  return await arrange(danmaku, options)
}

export function toAss(danmaku, options) {
  const textEscape = (s) =>
    s.replace(/{/g, "｛").replace(/}/g, "｝").replace(/\s/g, " ")

  const formatColorChannel = (v) =>
    (v & 255).toString(16).toUpperCase().padStart(2, "0")

  const formatColor = (color) =>
    "&H" + [color.b, color.g, color.r].map(formatColorChannel).join("")

  const formatTimestamp = (time) => {
    const value = Math.round(time * 100) * 10
    const hour = Math.floor(value / 3600000)
    const rem = value - hour * 3600000
    const minute = Math.floor(rem / 60000)
    const rem2 = rem - minute * 60000
    const second = Math.floor(rem2 / 1000)
    const centisecond = Math.floor((rem2 - second * 1000) / 10)
    const pad2 = (n) => String(n).padStart(2, "0")
    return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${pad2(centisecond)}`
  }

  const isDefaultColor = ({ r, g, b }) => r === 255 && g === 255 && b === 255
  const isDarkColor = ({ r, g, b }) => r * 0.299 + g * 0.587 + b * 0.114 < 0x30

  const header = (info) => [
    "[Script Info]",
    `Title: ${info.title}`,
    `Original Script: ${info.original}`,
    "ScriptType: v4.00+",
    "Collisions: Normal",
    `PlayResX: ${info.playResX}`,
    `PlayResY: ${info.playResY}`,
    "Timer: 100.0000",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Fix,${info.fontFamily},${info.fontSize},&H${info.alpha}FFFFFF,&H${info.alpha}FFFFFF,&H${info.alpha}000000,&H${info.alpha}000000,1,0,0,0,100,100,0,0,1,2,0,2,20,20,2,0`,
    `Style: Rtl,${info.fontFamily},${info.fontSize},&H${info.alpha}FFFFFF,&H${info.alpha}FFFFFF,&H${info.alpha}000000,&H${info.alpha}000000,1,0,0,0,100,100,0,0,1,2,0,2,20,20,2,0`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ]

  const lineColor = ({ color }) => {
    let result = ""
    if (!isDefaultColor(color)) result += `\\c${formatColor(color)}`
    if (isDarkColor(color)) result += `\\3c&HFFFFFF`
    return result
  }

  let defaultFontSize
  const lineFontSize = ({ size }) => {
    if (size === defaultFontSize) return ""
    return `\\fs${size}`
  }
  const getCommonFontSize = (list) => {
    const count = new Map()
    let commonCount = 0,
      common = 1
    list.forEach(({ size }) => {
      let value = 1
      if (count.has(size)) value = count.get(size) + 1
      count.set(size, value)
      if (value > commonCount) {
        commonCount = value
        common = size
      }
    })
    defaultFontSize = common
    return common
  }

  const lineMove = ({ layout: { type, start = null, end = null } }) => {
    if (type === "Rtl" && start && end)
      return `\\move(${start.x},${start.y},${end.x},${end.y})`
    if (type === "Fix" && start) return `\\pos(${start.x},${start.y})`
    return ""
  }

  const formatLine = (line) => {
    const start = formatTimestamp(line.layout.start.time)
    const end = formatTimestamp(line.layout.end.time)
    const type = line.layout.type
    const color = lineColor(line)
    const fontSize = lineFontSize(line)
    const move = lineMove(line)
    const format = `${color}${fontSize}${move}`
    const text = textEscape(line.text)
    return `Dialogue: 0,${start},${end},${type},,20,20,2,,{${format}}${text}`
  }

  const info = {
    title: danmaku.meta.name,
    original: danmaku.meta.url,
    playResX: options.resolutionX,
    playResY: options.resolutionY,
    fontFamily: options.fontFamily,
    fontSize: getCommonFontSize(danmaku.layout),
    alpha: formatColorChannel((0xff * (100 - options.textOpacity)) / 100),
  }

  const lines = header(info)
  const layout = danmaku.layout || []
  for (let i = 0; i < layout.length; i++) {
    const line = layout[i]
    if (!line || !line.layout) continue
    lines.push(formatLine(line))
  }

  return lines.join("\r\n")
}

export function detectFormat(content, filePath = "") {
  const text =
    typeof content === "string"
      ? stripBom(content)
      : stripBom(new TextDecoder("utf-8").decode(content))
  const head = text.trimStart()
  const ext = String(path.extname(filePath || "")).toLowerCase()

  if (head.startsWith("<") || ext === ".xml") {
    if (/<chatid>\d+<\/chatid>/i.test(text) && /<d\b/i.test(text)) {
      return "bilibili_xml"
    }
    if (/<chat\b/i.test(text) || /<c\b/i.test(text)) {
      return "himawari"
    }
  }

  const json = tryJsonParse(text)
  if (json) {
    if (json?.data?.threads) return "niconico"
    if (Array.isArray(json?.danmakus)) return "acfun"
    if (Array.isArray(json?.added)) return "acfun_poll"

    if (Array.isArray(json)) {
      const first = json[0]
      if (Array.isArray(first)) {
        const f0 = first[0]
        if (f0?.c && f0?.m != null) return "acfun_v4"
      }
      if (first?.c && first?.m != null) return "acfun_v4"

      if (
        first &&
        typeof first === "object" &&
        first.text != null &&
        first.time != null &&
        first.color != null &&
        first.position != null &&
        first.size != null
      ) {
        return "bahamut"
      }
    }
  }

  throw new Error(
    `Unable to detect format. Supported: ${[
      "niconico",
      "acfun",
      "acfun_v4",
      "acfun_poll",
      "bahamut",
      "bilibili_xml",
      "himawari",
    ].join(", ")}`
  )
}

export async function convertDanmaku({
  format,
  content,
  title,
  url = "",
  options = {},
  layoutOptions = {},
} = {}) {
  if (!content) {
    throw new Error("content is required")
  }
  const selectedFormat = format ?? detectFormat(content)
  const parseFn = parser[selectedFormat]
  if (typeof parseFn !== "function") {
    throw new Error(
      `Unknown format: ${selectedFormat}. Available formats: ${Object.keys(parser).join(", ")}`
    )
  }

  const parsed = parseFn.call(parser, content)
  const danmaku = parsed.danmaku
  if (!Array.isArray(danmaku)) {
    throw new Error("Parsed result does not contain danmaku array")
  }

  const mergedOptions = { ...defaultOptions, ...options }
  const mergedLayoutOptions =
    selectedFormat === "niconico"
      ? { rtlTimeIsCenter: true, ...mergedOptions, ...layoutOptions }
      : { ...mergedOptions, ...layoutOptions }

  const layout = await toLayout(danmaku, mergedLayoutOptions)

  const autoTitleSource =
    title ??
    parsed.meta?.name ??
    String(parsed.cid ?? parsed.thread ?? parsed.id ?? "Danmaku")

  const item = {
    id: parsed.cid ?? parsed.thread ?? parsed.id ?? null,
    meta: { name: autoTitleSource, url },
    content: danmaku,
    layout,
  }

  return toAss(item, mergedOptions)
}

export async function convertFile(inputPath) {
  const absInput = path.resolve(process.cwd(), inputPath)
  const raw = fs.readFileSync(absInput, "utf8")
  const title = path.basename(absInput, path.extname(absInput))
  const format = detectFormat(raw, absInput)
  const ass = await convertDanmaku({ format, content: raw, title })
  const outPath = path.join(
    path.dirname(absInput),
    path.basename(absInput, path.extname(absInput)) + ".ass"
  )
  fs.writeFileSync(outPath, ass, "utf8")
  return outPath
}

export async function main(argv = process.argv.slice(2)) {
  const inputPath = argv[0]
  if (!inputPath) {
    console.error("USAGE: node converter/converter.js <inputFile>")
    process.exitCode = 1
    return
  }
  await convertFile(inputPath)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err?.stack || String(err))
    process.exitCode = 1
  })
}
