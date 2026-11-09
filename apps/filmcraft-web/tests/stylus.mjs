import assert from "node:assert/strict";
import { installTouch, touchTarget } from "../web/touch.js";

const bounds = { left: 10, top: 20 };
const layout = { pixelsPerPoint: 3, scrolls: [[0, 0, 400, 400]], marquees: [[0, 0, 400, 400]],
  holdDrags: [[100, 80, 100, 30]], marqueeBlocks: [[100, 80, 100, 30]],
  scrubs: [[20, 20, 30, 20]], trims: [{ rect: [96, 80, 8, 30], clip: [0, 0, 400, 400] }] };
const css = (x, y) => ({ x: bounds.left + x * 1.5, y: bounds.top + y * 1.5 });
const target = (x, y, mode = "auto", overlay = false) => touchTarget(css(x, y), { ...layout, overlay }, bounds, 2, mode, "pen");
assert.equal(target(150, 95).policy, "drag", "pen edits rows immediately, not finger scrolling");
assert.equal(target(25, 25).policy, "drag", "vertical pen scrubbing edits numeric values");
assert.equal(target(250, 250).policy, "drag", "empty pen drag can marquee without a hold");
assert.deepEqual(target(110, 95).offset, { x: 0, y: 0 }, "pen near a clip edge preserves its exact grab position");
assert.deepEqual(target(98, 95).offset, { x: 0, y: 0 }, "even exact edge hits do not jump");
assert.equal(target(150, 95, "scroll").policy, "scroll");
assert.equal(target(150, 95, "box").policy, "scroll", "box mode never moves occupied rows");
assert.equal(target(250, 250, "box").policy, "drag");
assert.equal(target(150, 95, "trim").policy, "scroll", "trim mode never grabs the body");
assert.equal(target(100, 95, "trim").policy, "drag");
assert.equal(target(94, 95, "trim").policy, "scroll", "pen Trim assist is smaller than a finger's 32px target");
assert.equal(target(250, 250, "box", true).policy, "drag", "dialogs override the panel underneath");

// Minimal capture/bubble fixture: test the installed listeners, not just a separate pen model.
class InputEvent {
  constructor(type, init = {}) { Object.assign(this, { type, isTrusted: false, buttons: 0, button: 0 }, init); }
  preventDefault() { this.defaultPrevented = true; }
  stopImmediatePropagation() { this.stopped = true; }
}
class Target {
  listeners = new Map();
  style = {};
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  dispatchEvent(event) {
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
const original = new Map(["document", "window", "MouseEvent", "PointerEvent", "WheelEvent", "setTimeout", "clearTimeout"]
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let timer;
try {
  Object.assign(globalThis, { document: doc, window: win, MouseEvent: InputEvent, PointerEvent: InputEvent, WheelEvent: InputEvent,
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
  send("pointermove", 222, 181, { buttons: 1 });
  assert.deepEqual(take(), [], "pen jitter does not select or edit");
  send("pointermove", 220, 150, { buttons: 1 });
  let output = take();
  assert.deepEqual(output.map(e => e.type), ["mousemove", "pointerdown", "mousemove"], "vertical pen movement edits without a hold");
  assert.equal(output[1].shiftKey, true, "pen multi-select honors the on-screen modifier");
  assert.equal(output[1].altKey, true, "physical keyboard modifiers also survive normalization");
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

  send("pointerdown"); timer(); take();
  send("pointerup");
  output = take().filter(e => e.type.startsWith("pointer"));
  assert.deepEqual(output.map(e => e.button), [2, 2], "hold opens context without a primary click");
  send("pointerdown", 220, 180, { button: 2, buttons: 2 });
  send("pointerup", 220, 180, { button: 2 });
  assert.deepEqual(take().filter(e => e.type.startsWith("pointer")).map(e => e.button), [2, 2], "barrel button opens one context menu");
  send("pointerdown", 220, 180, { button: 5, buttons: 32 });
  send("pointermove", 230, 150, { buttons: 32 }); send("pointerup", 230, 150, { button: 5 });
  assert(!take().some(e => e.type.startsWith("pointer")), "eraser never deletes or presses an editing tool");
  for (const button of [0, 2]) {
    send("pointerdown", 220, 180, { button, buttons: button === 2 ? 2 : 1 });
    send("pointercancel", 0, 0);
    assert(!take().some(e => e.type.startsWith("pointer")), "cancelling a pending tip or side-button cannot click");
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
