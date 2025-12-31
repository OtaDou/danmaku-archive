import "dotenv/config"
import { test } from "@playwright/test"
import { readHistory, addRecord, saveFile } from "./utils.js"
import { defaultOptions, parser, toLayout, toAss } from "../converter.js"

// --- 常量配置 ---
const INTERCEPT_URL_REGEX = /nv-?comment.nicovideo.jp\/(api\.json|v1\/threads)/
const VIDEO_SELECTOR = `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`
const VIDEO_SELECTOR_ALT = `a.thumb_anchor.g-video-link`
const SAVE_BASE_PATH = `archive/`

const danmakuConfig = {
  fontFamily: "Microsoft YaHei", // Microsoft YaHei/MS Gothic/Yu Gothic
  offsetMs: -1000,
}

// --- 任务配置表 (新增番剧只需在此添加一行) ---
const TASKS = [
  { name: "かぐや様は告らせたい-ファーストキッスは終わらない", url: "https://anime.nicovideo.jp/detail/kaguya-love4/index.html" },
  { name: "この素晴らしい世界に爆焔を", url: "https://anime.nicovideo.jp/detail/konosuba-bakuen/index.html" },
  { name: "神無き世界のカミサマ活動", url: "https://anime.nicovideo.jp/detail/kamikatsu-anime/index.html", replace: ["「.*」", ""] },
]

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    { name: "user_session", value: process.env.NICO_USER_SESSION, domain: ".nicovideo.jp", path: "/" },
    { name: "user_session_secure", value: process.env.NICO_USER_SESSION_SECURE, domain: ".nicovideo.jp", path: "/" }
  ])
})

for (const task of TASKS) {
  test(task.name, async ({ page }) => {
    // 1. 初始化页面
    await page.route("**/*.{png,jpg,jpeg}", (r) => r.abort())
    await page.goto(task.url, { waitUntil: "domcontentloaded" })

    // 2. 获取并过滤新链接
    const rawLinks = await page.locator(task.selector || VIDEO_SELECTOR).evaluateAll(els => els.map(e => e.href))
    const uniqueLinks = [...new Set(rawLinks)].filter(link => task.selector ? true : link.includes("from"))
    const history = new Set(readHistory(task.name).map(it => it.url))
    const newLinks = uniqueLinks.filter(link => !history.has(link))

    console.log(`[${task.name}] found new video: ${newLinks.length}/${uniqueLinks.length}`)

    // 3. 循环处理
    for (const link of newLinks) {
      await page.goto(link, { waitUntil: "domcontentloaded" })
      
      // 标题处理：移除后缀 -> 冒号转全角 -> 自定义替换
      let title = (await page.title()).replace(" - ニコニコ動画", "").replace(/:/g, "：").trim()
      if (task.replace?.length === 2) title = title.replace(new RegExp(task.replace[0], 'g'), task.replace[1])
      
      if (/特別番組|総集編|特番|直前/.test(title)) continue

      await Promise.all([
        page.reload({ waitUntil: "domcontentloaded" }),
        page.waitForResponse(res => handleDanmaku(res, task.name, title, link), { timeout: 30000 })
      ])
    }
  })
}

// --- 弹幕拦截与保存逻辑 ---
async function handleDanmaku(res, seriesName, title, url) {
  if (!INTERCEPT_URL_REGEX.test(res.url())) return false

  const rawBody = await res.body()
  const { thread, danmaku: content } = parser.niconico(rawBody)
  const layout = await toLayout(content, { ...defaultOptions, ...danmakuConfig })
  const ass = toAss({ id: thread, meta: { name: title, url }, content, layout }, defaultOptions)
  
  // 敏感词过滤
  const wordFilter = /\u8fd1\u5e73|\u5171\u7523|\u4e2d\u5171|\u4e2d\u56fd/
  const cleanAss = ass.split('\n').filter(line => !wordFilter.test(line)).join('\n')
  
  const folder = `${SAVE_BASE_PATH}${seriesName}/`
  saveFile(folder, title, "ass", cleanAss)
  saveFile(folder, title, "json", String(rawBody))
  addRecord(seriesName, title, url)
  
  console.log(`Successfully saved: ${title}`)
  return true
}