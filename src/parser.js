// @ts-check
export default {
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
      .replace(/^(.)(.)(.)$/, "$0$0$1$1$2$2")
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
  /**
   * @param {string|ArrayBuffer} content
   * @return {{ cid: number, danmaku: Array<Danmaku> }}
   */
  bilibili_xml(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const clean = text.replace(
      /(?:[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g,
      ""
    )
    const data = new DOMParser().parseFromString(clean, "text/xml")
    const cid = +data.querySelector("chatid").textContent
    /** @type {Array<Danmaku>} */
    const danmaku = Array.from(data.querySelectorAll("d"))
      .map((d) => {
        const p = d.getAttribute("p")
        const [time, mode, size, color, create, bottom, sender, id] =
          p.split(",")
        return {
          text: d.textContent,
          time: +time,
          // We do not support ltr mode
          mode: [null, "RTL", "RTL", "RTL", "BOTTOM", "TOP"][+mode],
          size: +size,
          color: this.parseRgb256IntegerColor(color),
          bottom: bottom > 0,
        }
      })
      .filter(this.danmakuFilter)
    return { cid, danmaku }
  },

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ danmaku: Array<Danmaku> }}
   */
  acfun_v4(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const data = JSON.parse(text)
    const list = data.reduce((x, y) => x.concat(y), [])
    const danmaku = list
      .map((line) => {
        const [time, color, mode, size, sender, create, uuid] =
            line.c.split(","),
          text = line.m
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

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ danmaku: Array<Danmaku> }}
   */
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

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ danmaku: Array<Danmaku> }}
   */
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

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ thread: number, danmaku: Array<Danmaku> }}
   */
  niconico(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const mainJson = JSON.parse(text)
    var list = []
    mainJson.data.threads.forEach((thread) => {
      list = list.concat(thread.comments)
    })
    const thread = mainJson.data.globalComments[0].id
    const danmaku = list
      .map((comment) => {
        if (!comment.body || !(comment.vposMs >= 0) || !comment.no) return null
        const { vposMs, commands, body, no } = comment
        const commandString = commands.join(" ")
        return {
          text: body,
          time: vposMs / 1000,
          color: this.parseNiconicoColor(commandString),
          mode: this.parseNiconicoMode(commandString),
          size: this.parseNiconicoSize(commandString),
          bottom: false,
          id: no,
        }
      })
      .filter(this.danmakuFilter)
    return { thread, danmaku }
  },

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ danmaku: Array<Danmaku> }}
   */
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

  /**
   * @param {string|ArrayBuffer} content
   * @return {{ danmaku: Array<Danmaku> }}
   */
  himawari(content) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8").decode(content)
    const data = new DOMParser().parseFromString(text, "text/xml")
    const danmakuType1 = Array.from(
      data.querySelectorAll("c:not([deleted])")
    ).map((c) => {
      const p = c.getAttribute("p")
      const [vpos, date, no, user_id, ng_cnt, group_id, mail] = p.split(",")
      return {
        vpos,
        date_1: date,
        no,
        user_id,
        ng_cnt,
        group_id,
        mail,
        text: c.textContent,
      }
    })
    const danmakuType2 = Array.from(
      data.querySelectorAll("chat:not([deleted])")
    ).map((c) => {
      const vpos = c.getAttribute("vpos")
      const date = c.getAttribute("date")
      const no = c.getAttribute("no")
      const user_id = c.getAttribute("user_id")
      const mail = c.getAttribute("mail")
      return { vpos, date_2: date, no, user_id, mail, text: c.textContent }
    })
    /** @type {Array<Danmaku>} */
    const danmaku = danmakuType1
      .concat(danmakuType2)
      .map(({ vpos, text }) => {
        return {
          text,
          time: Number.parseInt(vpos, 36) / 100,
          mode: "RTL",
          size: 24,
          color: { r: 255, g: 255, b: 255 },
          bottom: false,
        }
      })
      .filter(this.danmakuFilter)
    return { danmaku }
  },
}
