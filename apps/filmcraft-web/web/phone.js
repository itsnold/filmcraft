// FCDroid phone presentation. Commands are FilmCraft's own; never replace the user's dock.
import { showTouchSheet, showTouchError } from "./touch.js";

export const PHONE_PANELS = [
  ["Program", "Preview"], ["Timeline", "Timeline"], ["Project", "Media"], ["Effects", "Effects"],
  ["Source", "Source"], ["EffectControls", "Effect controls"], ["Properties", "Properties"],
  ["LumetriColor", "Color"], ["Text", "Captions"], ["EssentialGraphics", "Graphics"],
  ["AudioTrackMixer", "Audio mixer"], ["History", "History"], ["Progress", "Export progress"],
  ["MediaBrowser", "Media browser"], ["Markers", "Markers"], ["ProjectNotes", "Notes"],
];

export function wantsPhoneLayout(width, screenWidth, screenHeight) {
  return Number.isFinite(width) && width > 0 && (width < 600 ||
    (Math.min(screenWidth, screenHeight) > 0 && Math.min(screenWidth, screenHeight) < 600));
}

export function menuLevel(items, path = [], query = "") {
  const text = query.trim().toLocaleLowerCase();
  if (text) return { groups: [], actions: items.filter(item => item.id &&
    [...(item.path || []), item.label].join(" ").toLocaleLowerCase().includes(text)) };
  const matches = items.filter(item => item.id && path.every((part, i) => item.path?.[i] === part));
  return { groups: [...new Set(matches.map(item => item.path?.[path.length]).filter(Boolean))],
    actions: matches.filter(item => (item.path || []).length === path.length) };
}

export class PhoneWorkspace {
  constructor(api, render = () => {}) {
    Object.assign(this, { api, render, mode: "auto", panel: "Program", compact: false,
      enabled: false, ready: false, applied: undefined, pending: 0, queue: Promise.resolve() });
  }
  sync() {
    this.pending++;
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (!this.ready) return;
      const enabled = this.mode === "phone" || (this.mode === "auto" && this.compact);
      const panel = enabled ? this.panel : null;
      if (this.applied !== panel) {
        await this.api.request("ui.set", { phonePanel: panel });
        this.applied = panel;
      }
      this.enabled = enabled;
      this.render(this);
    }).finally(() => { this.pending--; });
    return this.queue;
  }
  setMode(mode) {
    if (!["auto", "phone", "desktop"].includes(mode)) return Promise.reject(new Error("Unknown layout mode"));
    this.mode = mode; return this.sync();
  }
  setPanel(panel) {
    if (!PHONE_PANELS.some(([id]) => id === panel)) return Promise.reject(new Error("Unknown phone panel"));
    this.panel = panel; return this.sync();
  }
}

export function installPhoneWorkspace(api) {
  const style = document.createElement("style");
  style.textContent = `
    #phone-toolbar,#phone-nav { display:none; }
    html[data-phone-layout=true] #phone-toolbar { display:flex; position:fixed; inset:0 0 auto; height:52px;
      gap:4px; padding:4px; box-sizing:border-box; z-index:5; }
    html[data-phone-layout=true] #phone-nav { display:flex; position:fixed; bottom:52px; left:0; right:0;
      height:52px; gap:4px; padding:4px; box-sizing:border-box; z-index:5; }
    #phone-toolbar button,#phone-nav button { flex:1; min-width:0; min-height:44px; padding:2px; }
    html[data-phone-layout=true] #filmcraft_canvas { top:52px; bottom:104px; height:calc(100% - 156px) !important; }
  `;
  document.head.append(style);
  const toolbar = document.createElement("nav"); toolbar.id = "phone-toolbar"; toolbar.setAttribute("aria-label", "Phone editing actions");
  const nav = document.createElement("nav"); nav.id = "phone-nav"; nav.setAttribute("aria-label", "Workspace panels");
  const button = (parent, label, action) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("aria-label", label);
    b.onclick = () => Promise.resolve().then(action).catch(e => showTouchError(String(e)));
    parent.append(b); return b;
  };
  const invoke = (id, params = {}) => api.request("ui.menu.invoke", { id, params });
  const tabs = new Map();
  const controller = new PhoneWorkspace(api, state => {
    document.documentElement.dataset.phoneLayout = String(state.enabled);
    for (const [id, tab] of tabs) tab.setAttribute("aria-pressed", String(id === state.panel));
  });
  button(toolbar, "Menu", commands);
  button(toolbar, "Import", () => invoke("file.import"));
  button(toolbar, "Play", () => api.request("ui.playback", {}));
  button(toolbar, "Actions", selectionActions);
  button(toolbar, "Save", () => invoke("file.save"));
  for (const [id, label] of PHONE_PANELS.slice(0, 4)) tabs.set(id, button(nav, label, () => controller.setPanel(id)));
  button(nav, "More", more);
  document.body.append(toolbar, nav);

  function sheet(title, message) {
    const box = showTouchSheet(message, title);
    const options = document.createElement("div"); options.className = "phone-options"; box.append(options);
    return { box, options };
  }
  function layouts(parent) {
    for (const [id, label] of [["auto", "Auto layout"], ["phone", "Phone layout"], ["desktop", "Tablet layout"]]) {
      const b = button(parent, label, async () => {
        await controller.setMode(id);
        try { localStorage.setItem("fcdroid.layout", id); } catch { /* optional setting */ }
        document.getElementById("touch-error")?.remove();
      });
      b.setAttribute("aria-pressed", String(controller.mode === id));
    }
  }
  function more() {
    const { box, options } = sheet("Workspace", "Choose a panel. The tablet dock is preserved.");
    for (const [id, label] of PHONE_PANELS) button(options, label, async () => { await controller.setPanel(id); box.remove(); });
    button(options, "Export video", async () => { box.remove(); await invoke("mode.export"); });
    const preview = api.touchLayout()?.phonePreview !== false;
    button(options, preview ? "Hide companion panel" : "Show companion panel", async () => {
      await api.request("ui.set", { phonePreview: !preview }); box.remove();
    });
    layouts(options);
  }
  async function commands() {
    const { box, options } = sheet("Editor menus", "Browse menus or search for an action.");
    const input = document.createElement("input"); input.type = "search"; input.placeholder = "Find an action…";
    input.setAttribute("aria-label", "Search editor actions"); options.before(input);
    const items = await api.request("ui.menu.list", {});
    if (!box.isConnected) return;
    let path = [];
    const fill = () => {
      options.replaceChildren();
      if (path.length && !input.value.trim()) button(options, "‹ Back", () => { path.pop(); fill(); });
      const { groups, actions } = menuLevel(items, path, input.value);
      for (const group of groups) button(options, `${group} ›`, () => { path.push(group); fill(); });
      for (const item of actions) {
        const b = button(options, `${item.checked ? "✓ " : ""}${item.label}`, async () => { box.remove(); await invoke(item.id, item.params || {}); });
        b.disabled = !item.enabled;
        if (typeof item.checked === "boolean") b.setAttribute("aria-pressed", String(item.checked));
      }
    };
    input.oninput = fill; fill();
  }
  async function selectionActions() {
    const snapshot = await api.inspect();
    const clips = snapshot.selection || [];
    const { box, options } = sheet("Selection actions", `${clips.length} clips selected. Frame trims apply to the first selected clip and its linked media.`);
    let busy = false;
    const run = async (id, params = {}) => {
      if (busy) return;
      busy = true;
      try {
        const current = await api.inspect();
        if (current.activeSequence !== snapshot.activeSequence || JSON.stringify(current.selection) !== JSON.stringify(clips))
          throw new Error("Selection changed. Reopen Actions before editing.");
        await api.request("ui.set", { focused: "Timeline" });
        await invoke(id, params);
      } finally { busy = false; }
    };
    for (const [label, id] of [["Split at playhead", "sequence.addEdit"], ["Duplicate", "edit.duplicate"],
      ["Delete", "edit.clear"], ["Ripple delete", "edit.rippleDelete"]]) {
      button(options, label, async () => { await run(id); box.remove(); }).disabled = !clips.length;
    }
    for (const edge of ["in", "out"]) for (const deltaFrames of [-1, 1]) {
      button(options, `${edge === "in" ? "In" : "Out"} ${deltaFrames > 0 ? "+" : ""}${deltaFrames} frame`,
        () => run("timeline.trim", { clip: clips[0], edge, deltaFrames, mode: "regular" })).disabled = !clips.length;
    }
  }
  button(document.getElementById("touch-bar"), "Layout", () => {
    const { options } = sheet("Layout", "Choose Auto, Phone or Tablet presentation."); layouts(options);
  });
  const refresh = () => {
    controller.compact = wantsPhoneLayout(innerWidth, screen.width, screen.height);
    controller.sync().catch(e => showTouchError(String(e)));
  };
  window.addEventListener("resize", refresh);
  setInterval(() => {
    if (!controller.enabled || controller.pending || document.hidden) return;
    const panel = api.touchLayout()?.phonePanel;
    if (PHONE_PANELS.some(([id]) => id === panel) && panel !== controller.panel) {
      controller.panel = panel; controller.applied = panel; controller.render(controller);
    }
  }, 500);
  return { controller, async start() {
    try { const mode = localStorage.getItem("fcdroid.layout"); if (["auto", "phone", "desktop"].includes(mode)) controller.mode = mode; } catch { /* optional */ }
    controller.ready = true; refresh(); await controller.queue;
  } };
}
