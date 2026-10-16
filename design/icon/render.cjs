const { chromium } = require('/opt/npm-tools/node_modules/playwright')
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } })
  for (const v of ['v1','v2','v3']) {
    await p.goto('file://./icon.html'); await p.evaluate((v) => document.getElementById('X').classList.add(v), v)
    await p.waitForTimeout(200); await p.screenshot({ path: `./icon-${v}.png` })
  }
  await b.close()
})()
