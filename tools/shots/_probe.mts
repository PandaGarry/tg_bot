import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
const [,, port, W, H] = process.argv;
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage();
await p.setViewport({ width: +W, height: +H });
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0" });
await p.waitForTimeout(1200);
const r = await p.evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const box = (e) => e ? { w: +e.getBoundingClientRect().width.toFixed(1), h: +e.getBoundingClientRect().height.toFixed(1) } : null;
  const cs = (e, ...props) => { if (!e) return null; const g = getComputedStyle(e); const o = {}; props.forEach((k) => o[k] = g[k]); return o; };
  const top = q(".hud-top"), lord = q(".hud-lord"), res = q(".hud-res"), chip = q(".hud-res .chip");
  return { top: box(top), topCs: cs(top, "display", "gridTemplateColumns", "alignItems", "height"),
           lord: box(lord), res: box(res), resCs: cs(res, "display", "gridTemplateColumns", "gridTemplateRows", "alignItems", "height", "alignContent", "justifyContent"),
           chip: box(chip), chipCs: cs(chip, "aspectRatio", "width", "height", "minHeight", "alignSelf", "boxSizing", "padding", "border") };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close();
