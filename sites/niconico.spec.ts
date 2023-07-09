import { test, expect, type Page } from "@playwright/test"
import { readHistoryUrl, addRecord, saveFile } from "./utils.ts"
import { defaultOptions, parser, toLayout, toAss } from "../src/index.js"

const INTERCEPT_URL_REGEX = /nvcomment.nicovideo.jp\/(api\.json|v1\/threads)/
const VIDEO_SELECTOR = `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`
const SAVE_BASE_PATH = `archive/`

const danmakuConifg = {
  fontFamily: "Microsoft YaHei",
}

test.afterAll(() => {})

test("無職転生Ⅱ", async ({ page }) => {
  const config = {
    seriesName: "Mushoku_Tensei_2",
    homePage: "https://anime.nicovideo.jp/detail/mushokutensei-2ki/index.html",
    dayOfWeek: 0, // Sunday
  }

  await autoDownloadDanmaku(page, config)
})

async function autoDownloadDanmaku(page: Page, config: any) {
  if (
    config.dayOfWeek != undefined &&
    config.dayOfWeek !== new Date().getDay()
  ) {
    const day = new Date().toLocaleString("US-en", { weekday: "long" })
    console.log(
      `INFO: today is ${day}, skip download danmaku for ${config.seriesName}`
    )
    return
  }

  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page)

  const newLinks = filterNewLink(links)

  console.log(`INFO: ${newLinks.length}(new) / ${links.length}(free) `)

  for await (const link of newLinks) {
    await page.goto(link, { waitUntil: "domcontentloaded" })
    const title = (await page.title()).split("-")[0].trim()
    await Promise.all([
      page.reload({ waitUntil: "domcontentloaded" }),
      page.waitForResponse(async (res) => {
        return niconicoCommentsHandler(res, config, title, page.url())
      }),
    ])
  }
}

async function getVideoLinks(page) {
  const anchors = page.locator(VIDEO_SELECTOR).filter({
    has: page.locator(`[data-video-type="free"]`), // Free only
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
    addRecord(config.seriesName, bangumiTitle, seriesFolder, url)
  }
  return isComment
}

function filterNewLink(links) {
  const historyUrl = readHistoryUrl()
  if (historyUrl.length === 0) return links
  return links.filter((link) => {
    if (!link) return false
    return !historyUrl.some((h) => link.startsWith(h))
  })
}
