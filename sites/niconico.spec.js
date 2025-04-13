import "dotenv/config"
import { test } from "@playwright/test"
import { readHistory, addRecord, saveFile } from "./utils"
import { defaultOptions, parser, toLayout, toAss } from "../src/index.js"

const INTERCEPT_URL_REGEX = /nv-?comment.nicovideo.jp\/(api\.json|v1\/threads)/
const VIDEO_SELECTOR = `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`
const SAVE_BASE_PATH = `archive/`

const danmakuConifg = {
  fontFamily: "Microsoft YaHei", // Microsoft YaHei/MS Gothic/Yu Gothic
}

test.beforeEach(async ({ page }) => {
  await addUserCookie(
    page,
    process.env.NICO_USER_SESSION,
    process.env.NICO_USER_SESSION_SECURE
  )
})

test("悪役令嬢転生おじさん", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/tensei-ojisan/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("アラフォー男の異世界通販", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/arafo-tsuhan/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("Aランクパーティを離脱した俺は、元教え子たちと迷宮深部を目指す", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/arank-party-ridatsu/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("クラスの大嫌いな女子と結婚することになった", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/kura-kon/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("君のことが大大大大大好きな100人の彼女 第2期", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/hyakkano2/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

async function autoDownloadDanmaku(page, config) {
  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page, config.selector)

  const seriesRecords = readHistory(config.seriesName)

  let historyLinks = seriesRecords.map((it) => it.url)

  const newLinks = links.filter((link) => !historyLinks.includes(link))

  console.log(`INFO: ${newLinks.length}(new) / ${links.length}(avalible) `)

  for await (const link of newLinks) {
    await page.goto(link, { waitUntil: "domcontentloaded" })
    let title = (await page.title()).replace(" - ニコニコ動画", "").trim()
    if (/特別番組|総集編|直前特番/.test(title)) {
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
  let anchors = page.locator(selector)
  const links = await anchors.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href"))
  )
  return links.filter((v, i, arr) => arr.indexOf(v) === i && v.includes("from"))
}

async function niconicoCommentsHandler(res, config, title, url) {
  const link = res.url()
  const isComment = INTERCEPT_URL_REGEX.test(link)
  if (isComment) {
    const rawBody = await res.body()
    const { thread, danmaku: content } = parser.niconico(rawBody)
    const bangumiTitle = `${title}`
    const item = {
      id: thread,
      meta: { name: bangumiTitle, url },
      content: content,
      layout: await toLayout(content, {
        ...defaultOptions,
        ...danmakuConifg,
      }),
    }
    let ass = toAss(item, defaultOptions)
    console.log(`saving...${bangumiTitle}.ass`)
    const seriesFolder = SAVE_BASE_PATH + config.seriesName + "/"
    // save ass danmaku
    saveFile(seriesFolder, bangumiTitle, "ass", wordFilter(ass))
    // save raw json
    saveFile(seriesFolder, bangumiTitle, "json", String(rawBody))
    addRecord(config.seriesName, bangumiTitle, url)
  }
  return isComment
}

const wordFilter = (text, filter = /近平|共産|中共/) =>
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
