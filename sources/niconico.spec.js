import "dotenv/config"
import { test } from "@playwright/test"
import { readHistory, addRecord, saveFile } from "./utils.js"
import { defaultOptions, parser, toLayout, toAss } from "../converter.js"

const INTERCEPT_URL_REGEX = /nv-?comment.nicovideo.jp\/(api\.json|v1\/threads)/
const VIDEO_SELECTOR = `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`
const VIDEO_SELECTOR_ALT = `a.thumb_anchor.g-video-link`
const SAVE_BASE_PATH = `archive/`

const danmakuConfig = {
  fontFamily: "Microsoft YaHei", // Microsoft YaHei/MS Gothic/Yu Gothic
  offsetMs: -1000,
}

test.beforeEach(async ({ page }) => {
  await addUserCookie(
    page,
    process.env.NICO_USER_SESSION,
    process.env.NICO_USER_SESSION_SECURE
  )
})

test("しかのこのこのここしたんたん", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/anime-shikanoko/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("ハズレ枠の【状態異常スキル】で最強になった俺がすべてを蹂躙するまで", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/hazurewaku-anime/index.html",
  }

  await autoDownloadDanmaku(page, config)
})
async function autoDownloadDanmaku(page, config) {
  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page, config.selector)

  const seriesRecords = readHistory(config.seriesName)

  const historyLinkSet = new Set(seriesRecords.map((it) => it.url))
  const newLinks = links.filter((link) => !historyLinkSet.has(link))

  console.log(`INFO: ${newLinks.length}(new) / ${links.length}(available)`)

  for (const link of newLinks) {
    await page.goto(link, { waitUntil: "domcontentloaded" })
    let title = (await page.title()).replace(" - ニコニコ動画", "").trim()
    if (/特別番組|総集編|特番/.test(title)) {
      console.log(`skip... ${title}`)
      continue
    }
    title = reservedCharReplace(title)
    await Promise.all([
      page.reload({ waitUntil: "domcontentloaded" }),
      page.waitForResponse(
        async (res) => niconicoCommentsHandler(res, config, title, link),
        { timeout: 30_000 }
      ),
    ])
  }
}

async function getVideoLinks(page, selector = VIDEO_SELECTOR) {
  const anchors = page.locator(selector)
  const links = await anchors.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href"))
  )

  if (selector !== VIDEO_SELECTOR) return links

  const uniqueLinks = Array.from(new Set(links))
  return uniqueLinks.filter((href) => href?.includes("from"))
}

async function niconicoCommentsHandler(res, config, title, url) {
  const link = res.url()
  const isComment = INTERCEPT_URL_REGEX.test(link)
  if (!isComment) {
    return false
  }

  const rawBody = await res.body()
  const { thread, danmaku: content } = parser.niconico(rawBody)
  const bangumiTitle = `${title}`
  const seriesFolder = SAVE_BASE_PATH + config.seriesName + "/"
  const item = {
    id: thread,
    meta: { name: bangumiTitle, url },
    content,
    layout: await toLayout(content, {
      ...defaultOptions,
      ...danmakuConfig,
    }),
  }
  const ass = toAss(item, defaultOptions)
  console.log(`saving...${bangumiTitle}.ass`)
  // save ass danmaku
  saveFile(seriesFolder, bangumiTitle, "ass", wordFilter(ass))
  // save raw json
  saveFile(seriesFolder, bangumiTitle, "json", String(rawBody))
  addRecord(config.seriesName, bangumiTitle, url)

  return true
}

const wordFilter = (text, filter = /\u8fd1\u5e73|\u5171\u7523|\u4e2d\u5171|\u4e2d\u56fd/) =>
  text.split('\n').filter(line => !filter.test(line)).join('\n')

function reservedCharReplace(str) {
  return str.replace(":", "：")
}

async function addUserCookie(page, userSession, sessionSecure) {
  await page.context().addCookies([
    {
      name: "user_session",
      value: userSession,
      domain: ".nicovideo.jp",
      path: "/",
    },
    {
      name: "user_session_secure",
      value: sessionSecure,
      domain: ".nicovideo.jp",
      path: "/",
    },
  ])
}
