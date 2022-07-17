import { test, expect, type Page } from "@playwright/test"
import { readHistoryUrl, addRecord, saveFile } from "./utils.ts"
import { defaultOptions, parser, toLayout, toAss } from "../src/index.js"

const danmakuConifg = {
  fontFamily: "Microsoft YaHei",
}

test.afterAll(() => {})

test("異世界おじさん", async ({ page }) => {
  const config = {
    name: "異世界おじさん",
    homePage: "https://anime.nicovideo.jp/detail/isekaiojisan/index.html",
    locator: `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`,
    savePath: "archive/isekaiojisan/",
    commentUrl: /nvcomment.nicovideo.jp\/(api\.json|v1\/threads)/,
  }

  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page, config)

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
})

test("オーバーロードⅣ", async ({ page }) => {
  const config = {
    name: "オーバーロードⅣ",
    homePage: "https://anime.nicovideo.jp/detail/overlord-anime4/index.html",
    locator: `section >> nth=0 >> a[href^="https://www.nicovideo.jp/watch"]`,
    savePath: "archive/overlord4/",
    commentUrl: /nvcomment.nicovideo.jp\/(api\.json|v1\/threads)/,
  }

  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort()) //No image
  await page.goto(config.homePage, { waitUntil: "domcontentloaded" })

  const links = await getVideoLinks(page, config)

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
})

async function getVideoLinks(page, config) {
  const anchors = page.locator(config.locator).filter({
    hasText: config.name,
    has: page.locator(`[data-video-type="free"]`), // Free only
  })

  return await anchors.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href"))
  )
}

async function niconicoCommentsHandler(res, config, title, url) {
  const link = res.url()
  const isComment = config.commentUrl.test(link)
  if (isComment) {
    const rawBody = await res.body()
    const { thread, danmaku: content } = parser.niconico(rawBody)
    const name = `${title}`
    const item = {
      id: thread,
      meta: { name, url },
      content: content,
      layout: await toLayout(content, {
        ...defaultOptions,
        ...danmakuConifg,
      }),
    }
    let ass = toAss(item, defaultOptions)
    console.log(`saving...${name}.ass`)
    const fileName = saveFile(config.savePath, name, "ass", ass)
    saveFile(config.savePath, name, "json", String(rawBody))
    addRecord(url, config.savePath + fileName, config.name)
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
