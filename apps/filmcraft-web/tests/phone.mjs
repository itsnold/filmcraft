import assert from "node:assert/strict";
import { menuLevel, wantsPhoneLayout, PhoneWorkspace } from "../web/phone.js";

assert(wantsPhoneLayout(390, 390, 844));
assert(wantsPhoneLayout(844, 390, 844), "rotation keeps a phone in phone presentation");
assert(!wantsPhoneLayout(1024, 1024, 768));
assert(wantsPhoneLayout(500, 1024, 768), "split-screen tablet uses compact presentation");
assert(!wantsPhoneLayout(NaN, 390, 844));
const items = [
  { id: "file.open", label: "Open", path: ["File"], enabled: true },
  { id: "file.save", label: "Save", path: ["File"], enabled: false },
  { id: "clip.enable", label: "Enable", path: ["Clip", "Video"], params: { clips: [3] } },
];
assert.deepEqual(menuLevel(items).groups, ["File", "Clip"]);
assert.deepEqual(menuLevel(items, ["File"]).actions, items.slice(0, 2));
assert.deepEqual(menuLevel(items, [], "video").actions, [items[2]]);
assert.equal(menuLevel(items, ["File"]).actions[1].enabled, false);
const calls = [];
const workspace = new PhoneWorkspace({ request: async (...args) => { calls.push(args); } });
workspace.ready = true; workspace.compact = true;
await workspace.sync();
await workspace.setPanel("Timeline");
await workspace.setMode("desktop");
assert.deepEqual(calls.map(c => c[1].phonePanel), ["Program", "Timeline", null]);
await workspace.setMode("phone");
assert.equal(calls.at(-1)[1].phonePanel, "Timeline", "tablet toggle preserves last phone panel");
await assert.rejects(workspace.setPanel("Composition"), /Unknown/);
await assert.rejects(workspace.setMode("bogus"), /Unknown/);
const before = calls.length;
await Promise.all([workspace.setPanel("Effects"), workspace.setPanel("Project"), workspace.setPanel("Timeline")]);
assert.equal(calls.at(-1)[1].phonePanel, "Timeline");
assert(calls.length <= before + 1, "coalesce rapid navigation to latest desired panel");
console.log("phone: rotation, split-screen, menus, bound parameters, disabled actions and serialized navigation passed");
