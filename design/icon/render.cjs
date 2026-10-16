const { chromium } = require('/opt/npm-tools/node_modules/playwright')
const V = {
  a: { '--fs': '215px', '--cw': '860px', '--cr': '-150px', '--cb': '-24px' },
  b: { '--fs': '232px', '--cw': '800px', '--cr': '-130px', '--cb': '-30px', '--ty': '70px' },
  c: { '--fs': '200px', '--cw': '940px', '--cr': '-210px', '--cb': '-36px' },
}
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } })
  for (const [k, vars] of Object.entries(V)) {
    await p.goto('file://' + __dirname + '/icon.html')
    await p.evaluate((vars) => { const x = document.getElementById('X'); for (const [a, v] of Object.entries(vars)) x.style.setProperty(a, v) }, vars)
    await p.waitForTimeout(150); await p.screenshot({ path: `' + __dirname + '/w-${k}.png` })
  }
  await b.close()
})()
