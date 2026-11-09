import assert from "node:assert/strict";
import { installTouch, touchTarget, PenGesture } from "../web/touch.js";

const bounds = { left: 10, top: 20 };
const layout = { pixelsPerPoint: 3, scrolls: [[0, 0, 400, 400]], marquees: [[0, 0, 400, 400]],
  holdDrags: [[100, 80, 100, 30]], marqueeBlocks: [[100, 80, 100, 30]],
  scrubs: [[20, 20, 30, 20]], trims: [{ rect: [96, 80, 8, 30], clip: [0, 0, 400, 400] }] };
const css = (x, y) => ({ x: bounds.left + x * 1.5, y: bounds.top + y * 1.5 });
const target = (x, y, mode = "auto", overlay = false) => touchTarget(css(x, y), { ...layout, overlay }, bounds, 2, mode);
assert.equal(target(150, 95, "scroll").policy, "scroll");
assert.equal(target(150, 95, "box").policy, "scroll", "box mode never moves occupied rows");
assert.equal(target(250, 250, "box").policy, "drag");
assert.equal(target(150, 95, "trim").policy, "scroll", "trim mode never grabs the body");
assert.equal(target(100, 95, "trim").policy, "drag");
assert.equal(target(94, 95, "trim").policy, "drag", "explicit pen Trim shares the finger's accessible 32px target");
assert.equal(target(250, 250, "box", true).policy, "auto", "dialogs override the panel underneath");

// Same recognizer contract as ECDroid Android.44, including middle button and pen metadata.
const stream = [], pen = new PenGesture(e => stream.push(e));
const takeStream = () => stream.splice(0);
pen.down(7, { x: 10, y: 20, pressure: 0.6, tiltX: 15, shiftKey: true });
assert.deepEqual(takeStream().map(e => e.type), ["move", "down"], "pen presses on contact without a motion threshold");
pen.move(7, { x: 11, y: 21, pressure: 0.8, tiltX: 20, shiftKey: true });
let sample = takeStream()[0];
assert.equal(sample.pressure, 0.8); assert.equal(sample.tiltX, 20); assert(sample.shiftKey);
pen.up(7, { x: 40, y: 20 });
assert.deepEqual(takeStream().map(e => e.type), ["move", "up"]);
pen.cancelAll(); assert.deepEqual(takeStream(), []);
for (const button of [0, 1, 2, 5]) {
  pen.down(7, { x: 10, y: 20 }, "drag", button);
  pen.up(7, { x: 10, y: 20 });
  const buttons = takeStream().filter(e => e.type !== "move").map(e => e.button);
  assert.deepEqual(buttons, button === 5 ? [] : [button, button]);
}
for (const returnToOrigin of [false, true]) {
  pen.down(7, { x: 10, y: 20 }, "context"); pen.move(7, { x: 30, y: 20 });
  pen.up(7, { x: returnToOrigin ? 10 : 30, y: 20 });
  assert.deepEqual(takeStream(), [], "moving a context gesture cancels it even on returning to origin");
}
pen.down(7, { x: 10, y: 20 }, "scroll"); pen.move(7, { x: 11, y: 21 });
assert.deepEqual(takeStream(), []);
pen.move(7, { x: 40, y: 21 }); pen.move(7, { x: 45, y: 80 }); pen.up(7, { x: 45, y: 80 });
assert(takeStream().every(e => e.type === "wheel" && e.dy === 0 && !e.zoom), "pen scrolling locks its initial axis");
pen.down(7, { x: 10, y: 20 }, "scroll"); pen.up(7, { x: 10, y: 60 });
assert(takeStream().every(e => e.type === "wheel"), "coalesced Scroll release cannot click");

// Minimal capture/bubble fixture: test the installed listeners, not just a separate pen model.
class InputEvent {
  constructor(type, init = {}) { Object.assign(this, { isTrusted: false, buttons: 0, button: 0 }, init, { type }); }
  preventDefault() { this.defaultPrevented = true; }
  stopImmediatePropagation() { this.stopped = true; }
}
class Target {
  listeners = new Map();
  style = {};
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  dispatchEvent(event) {
    event.target ??= this;
    if (this === canvas) doc.deliver(event);
    if (!event.stopped) this.deliver(event);
    return !event.defaultPrevented;
  }
  deliver(event) { for (const fn of this.listeners.get(event.type) || []) { fn(event); if (event.stopped) break; } }
  getBoundingClientRect() { return bounds; }
  setPointerCapture() {}
}
const doc = new Target(), win = new Target(), canvas = new Target();
win.devicePixelRatio = 2;
const original = new Map(["document", "window", "Event", "MouseEvent", "PointerEvent", "WheelEvent", "setTimeout", "clearTimeout"]
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let timer;
try {
  Object.assign(globalThis, { document: doc, window: win, Event: InputEvent, MouseEvent: InputEvent, PointerEvent: InputEvent, WheelEvent: InputEvent,
    setTimeout: fn => { timer = fn; return fn; }, clearTimeout: id => { if (id === timer) timer = null; } });
  const adapter = installTouch(canvas, () => layout);
  const events = [];
  for (const type of ["pointerdown", "pointerup", "mousemove", "wheel", "mouseleave"])
    canvas.addEventListener(type, event => events.push(event));
  const send = (type, x = 220, y = 180, init = {}) => canvas.dispatchEvent(new InputEvent(type,
    { pointerType: "pen", pointerId: 7, clientX: x, clientY: y, isTrusted: true, ...init }));
  const take = () => events.splice(0);

  adapter.modifiers.shiftKey = true;
  send("pointermove");
  assert.equal(take()[0].shiftKey, true, "hover includes latched Shift");
  send("pointerdown", 220, 180, { buttons: 1, altKey: true });
  let output = take();
  assert.deepEqual(output.map(e => e.type), ["mousemove", "pointerdown"], "pen edits immediately on contact");
  assert.equal(output[1].pointerType, "pen", "normalization retains pen identity");
  assert.equal(output[1].shiftKey, true, "pen multi-select honors the on-screen modifier");
  assert.equal(output[1].altKey, true, "physical keyboard modifiers also survive normalization");
  send("pointermove", 222, 181, { buttons: 1 });
  assert.equal(take()[0].buttons, 1, "small pen movements remain precision editing");
  send("pointermove", 220, 150, { buttons: 1 });
  assert.deepEqual(take().map(e => e.type), ["mousemove"], "vertical movement keeps the same press");
  send("mousemove"); assert.deepEqual(take(), [], "trusted pen compatibility mousemove is not delivered twice");
  send("pointerup", 220, 140);
  output = take();
  assert.equal(output.filter(e => e.type === "pointerup").length, 1);
  assert.equal(output.find(e => e.type === "pointerup").clientY, 140, "final coalesced position is delivered");

  adapter.modifiers.ctrlKey = true; adapter.modifiers.altKey = true;
  send("pointerdown"); send("pointerup");
  output = take().filter(e => e.type.startsWith("pointer"));
  assert.deepEqual(output.map(e => e.button), [0, 0], "simple pen tap remains a primary click");
  assert(output.every(e => e.shiftKey && e.altKey && e.ctrlKey), "all modifier buttons apply to pen taps");
  adapter.modifiers.ctrlKey = false; adapter.modifiers.altKey = false;

  for (const pointerType of ["pen", "touch"]) {
    adapter.controls.context = true;
    send("pointerdown", 220, 180, { pointerType });
    assert.equal(adapter.controls.context, false, "Options is consumed once");
    if (pointerType === "touch") timer();
    assert.deepEqual(take(), [], "Options waits for release without selecting");
    send("pointerup", 220, 180, { pointerType });
    output = take().filter(e => e.type.startsWith("pointer"));
    assert.deepEqual(output.map(e => e.button), [2, 2], "Options works without a barrel button or hold");
  }
  send("pointerdown", 220, 180, { button: 2, buttons: 2 });
  send("pointerup", 220, 180, { button: 2 });
  assert.deepEqual(take().filter(e => e.type.startsWith("pointer")).map(e => e.button), [2, 2], "barrel button opens one context menu");
  for (const returnToOrigin of [false, true]) {
    send("pointerdown", 220, 180, { button: 2, buttons: 2 });
    send("pointermove", 250, 180, { buttons: 2 });
    send("pointerup", returnToOrigin ? 220 : 250, 180, { button: 2 });
    assert(!take().some(e => e.type.startsWith("pointer")), "barrel movement cancels menu even if the tip returns");
  }
  send("pointerdown", 220, 180, { button: 5, buttons: 32 });
  send("pointermove", 230, 150, { buttons: 32 }); send("pointerup", 230, 150, { button: 5 });
  assert(!take().some(e => e.type.startsWith("pointer")), "eraser never deletes or presses an editing tool");
  for (const button of [2, 5]) {
    send("pointerdown", 220, 180, { button, buttons: button === 2 ? 2 : 1 });
    send("pointercancel", 0, 0);
    assert(!take().some(e => e.type.startsWith("pointer")), "cancelling a side-button or eraser cannot click");
  }
  send("pointerdown", 220, 180, { buttons: 1 });
  send("pointermove", 250, 180, { buttons: 1 });
  send("pointermove", 260, 180, { button: 2, buttons: 3 });
  send("pointerup", 260, 180);
  assert(take().filter(e => e.type.startsWith("pointer")).every(e => e.button === 0), "side button midway through a drag never opens context");

  for (const cancellation of ["pointercancel", "lostpointercapture", "blur", "resize", "visibilitychange"]) {
    send("pointerdown", 220, 180, { buttons: 1 });
    send("pointermove", 250, 180, { buttons: 1 }); take();
    if (["blur", "resize"].includes(cancellation)) win.dispatchEvent(new InputEvent(cancellation));
    else if (cancellation === "visibilitychange") { doc.hidden = true; doc.dispatchEvent(new InputEvent(cancellation)); doc.hidden = false; }
    else send(cancellation, 0, 0);
    output = take();
    const up = output.filter(e => e.type === "pointerup");
    assert.equal(up.length, 1, `${cancellation} releases the logical pen press once`);
    assert.equal(up[0].clientX, 250, "cancellation never jumps to (0,0)");
    if (cancellation !== "pointercancel") {
      send("pointerup", 0, 0); assert(!take().some(e => e.type === "pointerup"), "late native release cannot click");
    }
  }

  // Touch present before or during pen-down cannot steal the pen drag or become a pinch.
  send("pointerdown", 100, 100, { pointerType: "touch", pointerId: 11 });
  send("pointerdown", 220, 180, { buttons: 1 });
  send("pointerdown", 200, 200, { pointerType: "touch", pointerId: 12 });
  send("pointermove", 230, 150, { buttons: 1 });
  send("pointermove", 300, 300, { pointerType: "touch", pointerId: 12 });
  send("pointerup", 230, 150);
  send("pointermove", 310, 310, { pointerType: "touch", pointerId: 12 });
  for (const pointerId of [11, 12]) send("pointerup", 300, 300, { pointerType: "touch", pointerId });
  output = take();
  assert(!output.some(e => e.type === "wheel"), "palm cannot turn pen editing into scrolling or zoom");
  assert.equal(output.filter(e => e.type === "pointerdown").length, 1, "only the pen starts an edit");
  send("pointerdown", 100, 100, { pointerType: "touch", pointerId: 13 });
  send("pointermove", 100, 140, { pointerType: "touch", pointerId: 13 });
  send("pointerup", 100, 140, { pointerType: "touch", pointerId: 13 });
  assert(take().some(e => e.type === "wheel"), "finger scrolling works again after pen and palm lift");

  adapter.controls.mode = "scroll";
  send("pointerdown"); send("pointermove", 220, 140, { buttons: 1 }); send("pointerup", 220, 140);
  output = take();
  assert(output.some(e => e.type === "wheel"));
  assert(!output.some(e => e.type === "pointerdown"), "explicit Scroll still protects edits with a pen");
  send("pointerdown"); send("pointerup");
  assert.equal(take().filter(e => e.type === "pointerdown").length, 1, "pen taps still select in Scroll mode");
  adapter.controls.mode = "auto";
  for (const point of [css(98, 95), css(110, 95), css(25, 25)]) {
    send("pointerdown", point.x, point.y);
    const down = take().find(e => e.type === "pointerdown");
    assert.equal(down.clientX, point.x); assert.equal(down.clientY, point.y, "Auto never snaps pen coordinates");
    send("pointerup", point.x, point.y); take();
  }
  send("pointermove", 220, 180, { pointerType: "mouse" });
  send("mousemove", 220, 180, { pointerType: "mouse" });
  assert(take().some(e => e.type === "mousemove" && e.isTrusted), "switching to a real mouse retains its native path");
} finally {
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
console.log("Stylus: precision targets, hover, modifiers, context, palm isolation, cancellation and finger fallback passed");
