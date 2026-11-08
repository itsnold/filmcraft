// Real Chromium touch integration; --dist additionally tests the compiled Rust/WASM editor.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";

const argument = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const chromePath = argument("--chrome", "google-chrome");
const dist = argument("--dist", null);
const profile = await mkdtemp(join(tmpdir(), "fcdroid-browser-"));
const root = resolve(dist || new URL("../web", import.meta.url).pathname);
const fake = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}canvas{position:absolute;inset:0;width:100%;height:100%}</style>
<canvas id="filmcraft_canvas"></canvas><script type="module">
import {installTouch,installTouchBar,dismissTouchOverlay} from '/touch.js';
import {installPhoneWorkspace} from '/phone.js';
window.calls=[];window.events=[];window.layout={pixelsPerPoint:devicePixelRatio,scrolls:[[0,0,800,600]],
 holdDrags:[[30,150,200,50]],controls:[[0,0,800,40]],marquees:[[0,40,800,500]]};
window.filmcraft={touchLayout:()=>layout, dismissTouchOverlay, inspect:async()=>({selection:[1],activeSequence:1}),
 execute:async()=> '100',request:async(method,params)=>{calls.push([method,params]);
 if(method==='ui.set'&&'phonePanel' in params)layout.phonePanel=params.phonePanel;
 if(method==='ui.menu.list')return [{id:'file.open',label:'Open',path:['File'],enabled:true}];}};
const canvas=document.querySelector('canvas');const adapter=installTouch(canvas);installTouchBar(canvas,adapter);
for(const type of ['pointerdown','pointerup','wheel'])canvas.addEventListener(type,e=>events.push({type,dy:e.deltaY,dx:e.deltaX,button:e.button}));
await installPhoneWorkspace(filmcraft).start();window.ready=true;
</script>`;
const mime = { ".js": "text/javascript", ".html": "text/html", ".wasm": "application/wasm", ".png": "image/png" };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if (!dist && path === "/") { response.setHeader("Content-Type", "text/html"); response.end(fake); return; }
  const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
  if (!file.startsWith(root + "/")) { response.writeHead(403).end(); return; }
  try {
    response.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = spawn(chromePath, ["--headless=new", "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] });
let stderr = "", socket, sequence = 0;
const pending = new Map(), errors = [];
browser.stderr.on("data", data => { stderr = (stderr + data).slice(-12000); });
browser.on("error", error => { stderr += String(error); });
const pause = ms => new Promise(r => setTimeout(r, ms));
const deadline = setTimeout(() => { console.error("Browser test timed out", stderr, errors); browser.kill(); process.exit(1); }, dist ? 240000 : 60000);
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function js(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await js(expression)) return; await pause(100); }
  throw new Error(`Timed out: ${expression}\n${JSON.stringify(errors)}\n${stderr}`);
}
const touch = (type, points) => send("Input.dispatchTouchEvent", { type, touchPoints: points.map((point, index) => ({ id: index + 1, ...point })) });
try {
  let port;
  for (let n = 0; n < 150 && !port; n++) {
    try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await pause(100); }
  }
  assert(port, stderr);
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data), waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); }
    else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  if (process.argv.includes("--webgl-4096")) await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    for(const type of [WebGLRenderingContext,WebGL2RenderingContext]){
      const original=type.prototype.getParameter;
      type.prototype.getParameter=function(p){const v=original.call(this,p);return p===this.MAX_TEXTURE_SIZE||p===this.MAX_RENDERBUFFER_SIZE?Math.min(v,4096):v;};
    }` });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/?android&webgl&cpu&empty` });
  await until(dist ? "window.filmcraftLoad?.readyMs && document.documentElement.dataset.phoneLayout==='true'" : "window.ready", dist ? 180000 : 10000);
  assert.equal(await js("filmcraft.touchLayout().phonePanel"), "Program");
  if (dist) {
    assert.equal(await js("filmcraft.info().version"), "0.18.0");
    await js("filmcraft.execute('file.openDemoProject',{})");
  }
  await js("[...document.querySelectorAll('#phone-nav button')].find(b=>b.textContent==='Timeline').click()");
  await until("filmcraft.touchLayout().phonePanel==='Timeline'");
  await until("document.querySelector('#phone-nav button[aria-pressed=true]')?.textContent==='Timeline'");
  assert.equal(await js("document.querySelector('#phone-nav button[aria-pressed=true]').textContent"), "Timeline");
  // Special-mode state must be the SAME state read by the installed touch adapter.
  await js("[...document.querySelectorAll('#touch-bar button')].find(b=>b.textContent==='Trim').click()");
  await pause(100);
  assert.equal(await js("document.querySelector('#touch-bar').dataset.mode"), "trim");
  assert.equal(await js("filmcraft.dismissTouchOverlay()"), true);
  assert.equal(await js("document.querySelector('#touch-bar').dataset.mode"), "auto");
  if (!dist) {
    const area = await js("document.querySelector('canvas').getBoundingClientRect().top");
    await touch("touchStart", [{ x: 100, y: area + 170 }]);
    await touch("touchMove", [{ x: 180, y: area + 170 }]);
    await touch("touchEnd", []); await pause(100);
    const events = await js("events.splice(0)");
    assert(events.some(e => e.type === "wheel" && e.dx !== 0), "quick swipe scrolls");
    assert(!events.some(e => e.type === "pointerdown"), "quick swipe must not edit a clip");
    await js("[...document.querySelectorAll('#touch-bar button')].find(b=>b.textContent==='Shift').click()");
    assert.equal(await js("[...document.querySelectorAll('#touch-bar button')].find(b=>b.textContent==='Shift').getAttribute('aria-pressed')"), "true");
  } else {
    await js("filmcraft.request('ui.menu.invoke',{id:'view.zoomToSequence'})");
    await pause(1000);
    const geometry = await js("filmcraft.touchLayout()");
    assert(geometry.holdDrags.length > 0, "actual engine registers visible clip targets");
    assert(geometry.trims.length > 0, "actual engine registers visible trim edges");
    await js("filmcraft.saveRecovery()");
    await js("[...document.querySelectorAll('#phone-nav button')].find(b=>b.textContent==='Media').click()");
    await until("filmcraft.touchLayout().phonePanel==='Project'");
    await until("filmcraft.touchLayout().marquees.length > 0 && filmcraft.touchLayout().holdDrags.length > 0");
    const project = await js("(async()=>({layout:filmcraft.touchLayout(),elements:await filmcraft.request('ui.elements',{prefix:'project.item.'})}))()");
    const media = project.elements.find(e => /^project\.item\.\d+$/.test(e.id) && e.rect[2] > 0 && e.rect[3] > 0);
    assert(media, "demo Project panel exposes a visible item");
    const overlaps = (a,b) => a[0] < b[0]+b[2] && b[0] < a[0]+a[2] && a[1] < b[1]+b[3] && b[1] < a[1]+a[3];
    assert(project.layout.holdDrags.some(r => overlaps(r, media.rect)), "Project items are registered as hold-to-drag targets");
    const background = await js("filmcraft.request('ui.elements',{prefix:'project.touchBackground'})");
    assert(background.length && project.layout.marquees.some(r => overlaps(r, background[0].rect)), "Project background is a marquee target");
    assert(project.layout.scrolls.some(r => r[2] > 0), "phone Project and companion Timeline expose scrolling regions");
  }
  await js("[...document.querySelectorAll('#phone-toolbar button')].find(b=>b.textContent==='Menu').click()");
  await until("document.querySelector('#touch-error button')");
  assert.equal(await js("document.querySelector('#touch-error').getAttribute('role')"), "dialog");
  assert.equal(await js("filmcraft.dismissTouchOverlay()"), true);
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
  await pause(500);
  assert.equal(await js("document.documentElement.dataset.phoneLayout"), "true", "landscape phone stays compact");
  assert.deepEqual(errors, [], "no unhandled browser errors");
  if (dist) {
    await mkdir("target/android-smoke", { recursive: true });
    const image = await send("Page.captureScreenshot", { format: "png" });
    await writeFile("target/android-smoke/landscape.png", Buffer.from(image.data, "base64"));
  }
  console.log(`Android browser integration passed (${dist ? "compiled WASM" : "touch adapter"})`);
} finally {
  clearTimeout(deadline); socket?.close(); browser.kill(); server.close();
  await new Promise(r => browser.exitCode !== null || browser.signalCode !== null ? r() : browser.once("exit", r));
  // Chromium subprocesses may finish profile writes just after the parent exits.
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
