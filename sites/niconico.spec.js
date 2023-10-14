import "dotenv/config"
import { test } from "@playwright/test"
import { readHistory, addRecord, saveFile } from "./utils"
import { defaultOptions, parser, toLayout, toAss } from "../src/index.js"

const INTERCEPT_URL_REGEX = /nvcomment.nicovideo.jp\/(api\.json|v1\/threads)/
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

test("無職転生Ⅱ", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/mushokutensei-2ki/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("政宗くんのリベンジR", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/masamune-tv2/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("てんぷる", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/temple-anime/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("英雄教室", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage:
      "https://anime.nicovideo.jp/detail/eiyukyoushitsu-anime/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

test("白聖女と黒牧師", async ({ page }, testInfo) => {
  const config = {
    seriesName: testInfo.title,
    homePage: "https://anime.nicovideo.jp/detail/shiroseijyo-anime/index.html",
  }

  await autoDownloadDanmaku(page, config)
})

async function autoDownloadDanmaku(page, config) {
  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page)

  const seriesRecords = readHistory(config.seriesName)

  let historyLinks = seriesRecords.map((it) => it.url)

  const newLinks = links.filter((link) => !historyLinks.includes(link))

  console.log(`INFO: ${newLinks.length}(new) / ${links.length}(avalible) `)

  for await (const link of newLinks) {
    await page.goto(link, { waitUntil: "domcontentloaded" })
    const title = (await page.title()).replace(" - ニコニコ動画", "").trim()
    await Promise.all([
      page.reload({ waitUntil: "domcontentloaded" }),
      page.waitForResponse(
        async (res) => {
          return niconicoCommentsHandler(res, config, title, link)
        },
        {
          timeout: 30_000,
        }
      ),
    ])
  }
}

async function getVideoLinks(page, freeOnly = false) {
  let anchors = page.locator(VIDEO_SELECTOR)
  if (freeOnly)
    anchors = anchors.filter({
      has: page.locator(`[data-video-type="free"]`),
    })

  return await anchors.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href"))
  )
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
    saveFile(seriesFolder, bangumiTitle, "ass", ass)
    // save raw json
    saveFile(seriesFolder, bangumiTitle, "json", String(rawBody))
    addRecord(config.seriesName, bangumiTitle, url)
  }
  return isComment
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
