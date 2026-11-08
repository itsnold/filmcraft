//! Phone presentation and completed-frame geometry for the Android gesture adapter.
//! All edits still use FilmCraft commands. The user's dock is never mutated here.

use egui::{Rect, pos2, vec2};
use serde_json::{Value, json};

use crate::FilmcraftApp;
use crate::dock::PanelKind;

/// Draw a panel in a clipped child, with the same automation id as the docked panel.
fn panel(app: &mut FilmcraftApp, ui: &mut egui::Ui, kind: PanelKind, rect: Rect) {
    app.auto.add(&format!("panel.{}", kind.id()), rect, kind.title());
    let mut child = ui.new_child(egui::UiBuilder::new().max_rect(rect).id_salt(("phone", kind)));
    child.set_clip_rect(rect.intersect(ui.clip_rect()));
    // Use compact track headers in both the main and companion Timeline, without saving them.
    let header = app.ui.timeline.header_w;
    if kind == PanelKind::Timeline {
        app.ui.timeline.header_w = 112.0_f32.min(rect.width() * 0.32);
    }
    crate::panels::show(app, &mut child, kind, rect);
    app.ui.timeline.header_w = header;
}

/// One main panel, optionally with a live Program preview above/beside it.
pub(crate) fn show(app: &mut FilmcraftApp, ui: &mut egui::Ui, body: Rect) {
    if let Some(panel) = app.pending_panel_raise.take() {
        app.ui.phone_panel = Some(panel);
    }
    let Some(kind) = app.ui.phone_panel else { return };
    let mut main = body;
    let companion = match kind {
        PanelKind::Timeline | PanelKind::Properties | PanelKind::EffectControls => Some(PanelKind::Program),
        PanelKind::Project | PanelKind::Effects | PanelKind::MediaBrowser | PanelKind::EssentialGraphics => Some(PanelKind::Timeline),
        _ => None,
    };
    if let Some(companion) = companion.filter(|_| app.ui.phone_preview) {
        let landscape = body.width() > body.height() * 1.3;
        let enough = if landscape { body.width() >= 580.0 } else { body.height() >= 400.0 };
        if enough {
            let preview = if landscape {
                let x = body.min.x + body.width() * 0.38;
                main.min.x = x + 6.0;
                Rect::from_min_max(body.min, pos2(x, body.max.y))
            } else {
                let y = body.min.y + body.height() * 0.32;
                main.min.y = y + 6.0;
                Rect::from_min_max(body.min, pos2(body.max.x, y))
            };
            panel(app, ui, companion, preview);
        }
    }
    panel(app, ui, kind, main);
}

/// Snapshot only current-pass hit targets, not guessed screen proportions or stale panel rects.
pub fn touch_layout(app: &FilmcraftApp, ctx: &egui::Context) -> Value {
    let mut scrolls = Vec::new();
    let mut viewers = Vec::new();
    let mut drags = Vec::new();
    let mut holds = Vec::new();
    let mut controls = Vec::new();
    let mut tracks = Vec::new();
    let mut marquees = Vec::new();
    let mut blocks = Vec::new();
    let mut trims = Vec::new();
    for e in app.auto.all().iter().filter(|e| e.window.is_none() && e.rect[2] > 0.0 && e.rect[3] > 0.0) {
        let id = e.id.as_str();
        if id == "panel.Program" || id == "panel.Source" {
            viewers.push(e.rect);
        } else if id.starts_with("panel.") && !id.contains("menu") && id.split('.').count() == 2 {
            scrolls.push(e.rect);
        }
        if id.starts_with("panel.drag.") || id.starts_with("panel.gutter.") || id.starts_with("panel.tab.") {
            drags.push(e.rect);
        }
        if id == "timeline.ruler" || id == "timeline.timecode" || id == "effectControls.ruler" {
            controls.push(e.rect);
        }
        if id == "timeline.zoomBar.track" {
            tracks.push(e.rect);
        }
        if id == "touch.timeline.empty" || id == "touch.effectControls.selectionArea" || project_background(id) {
            marquees.push(e.rect);
        }
        if draggable_item(id) {
            holds.push(e.rect);
            blocks.push(e.rect);
        }
        if id.starts_with("touch.trim.") {
            let [x, y, w, h] = e.rect;
            if let Some(content) = app.auto.find("touch.timeline.empty") {
                let left = (x - 16.0).max(content.rect[0]);
                let right = (x + w + 16.0).min(content.rect[0] + content.rect[2]);
                trims.push(json!({"rect": e.rect, "clip": [left, y, (right - left).max(0.0), h]}));
            }
        }
    }
    json!({
        "pixelsPerPoint": ctx.pixels_per_point(), "phonePanel": app.ui.phone_panel,
        "phonePreview": app.ui.phone_preview, "viewers": viewers, "scrolls": scrolls,
        "drags": drags, "holdDrags": holds, "controls": controls, "controlTracks": tracks,
        "scrubs": number_targets(ctx),
        "marquees": marquees, "marqueeBlocks": blocks, "trims": trims,
        "overlay": app.dialog.is_some() || app.ui.clip_dialog.is_some() || app.ui.extras.dialog.is_some()
            || ctx.memory(|m| m.top_modal_layer().is_some()) || egui::Popup::is_any_open(ctx),
        "keyboardFocus": ctx.egui_wants_keyboard_input(),
        "selection": {"clips": app.session.state.selection.len()}
    })
}

/// The registered body (not neighbouring buttons) of an editor item that can actually drag.
fn draggable_item(id: &str) -> bool {
    id.starts_with("touch.clip.")
        || id.starts_with("touch.project.card.")
        || id.contains(".kf.")
        || (id.starts_with("effectControls.") && id.contains(".keyframe."))
        || id.starts_with("touch.mediaBrowser.file.")
        || id.starts_with("gfxTemplates.item.")
        || project_drag_item(id)
        || effect_drag_item(id)
}

/// Only item and bin bodies, not their nested buttons, are draggable project targets.
fn project_drag_item(id: &str) -> bool {
    let Some((body, number)) = id.rsplit_once('.') else { return false };
    let Some((prefix, kind)) = body.rsplit_once('.') else { return false };
    (prefix == "project" || prefix.strip_prefix("projectBin.").is_some_and(|n| n.parse::<usize>().is_ok()))
        && matches!(kind, "item" | "bin")
        && number.parse::<u64>().is_ok()
}

/// Project's empty area and freeform canvas handle marquee selection.
fn project_background(id: &str) -> bool {
    let Some((prefix, suffix)) = id.rsplit_once('.') else { return false };
    (prefix == "project" || prefix.strip_prefix("projectBin.").is_some_and(|n| n.parse::<usize>().is_ok()))
        && matches!(suffix, "empty" | "freeform" | "touchBackground")
}

/// Effects, Lumetri looks and preset tiles support the editor's native drag path.
fn effect_drag_item(id: &str) -> bool {
    id.starts_with("effects.item.") || id.starts_with("effects.preset.") || id.starts_with("effects.lumetriPreset.") || id.starts_with("effects.presetGrid.")
}

/// Remember numeric scrub targets for this pass only, clipped to the panel that painted them.
pub(crate) fn register_number(ui: &egui::Ui, rect: Rect) {
    let rect = rect.intersect(ui.clip_rect());
    if rect.width() <= 0.0 || rect.height() <= 0.0 {
        return;
    }
    let pass = ui.ctx().cumulative_pass_nr();
    ui.ctx().data_mut(|data| {
        let targets = data.get_temp_mut_or_default::<(u64, Vec<[f32; 4]>)>(egui::Id::unique("mobile.numbers"));
        if targets.0 != pass {
            targets.0 = pass;
            targets.1.clear();
        }
        if targets.1.len() < 16384 {
            targets.1.push([rect.min.x, rect.min.y, rect.width(), rect.height()]);
        }
    });
}

fn number_targets(ctx: &egui::Context) -> Vec<[f32; 4]> {
    ctx.data(|data| data.get_temp::<(u64, Vec<[f32; 4]>)>(egui::Id::unique("mobile.numbers")))
        .filter(|(pass, _)| *pass == ctx.cumulative_pass_nr())
        .map(|(_, targets)| targets)
        .unwrap_or_default()
}

/// Register real, visible clip ends. Do not manufacture a trim edge where a clip is clipped offscreen.
pub(crate) fn trim_targets(app: &mut FilmcraftApp, body: Rect, visible: Rect, id: u64) {
    for (edge, x) in [("in", body.min.x + 2.0), ("out", body.max.x - 2.0)] {
        if x >= visible.min.x && x <= visible.max.x && visible.height() > 0.0 {
            let rect = Rect::from_center_size(pos2(x, visible.center().y), vec2(4.0, visible.height()));
            app.auto.add(&format!("touch.trim.{id}.{edge}"), rect, "Trim clip edge");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offscreen_clip_ends_are_not_trim_targets() {
        let mut app = FilmcraftApp::new(filmcraft_engine::Session::default());
        let body = Rect::from_min_max(pos2(-100.0, 10.0), pos2(300.0, 60.0));
        trim_targets(&mut app, body, Rect::from_min_max(pos2(0.0, 10.0), pos2(200.0, 60.0)), 1);
        assert!(app.auto.all().is_empty());
    }

    #[test]
    fn both_visible_clip_ends_have_targets() {
        let mut app = FilmcraftApp::new(filmcraft_engine::Session::default());
        let body = Rect::from_min_max(pos2(20.0, 10.0), pos2(180.0, 60.0));
        trim_targets(&mut app, body, body, 1);
        assert_eq!(app.auto.all().len(), 2);
    }

    #[test]
    fn project_and_effect_gestures_only_target_draggable_bodies() {
        for id in ["project.item.12", "project.bin.4", "projectBin.0.item.12"] {
            assert!(project_drag_item(id), "{id}");
        }
        for id in ["project.item.12.selected", "project.bin.4.toggle", "project.search", "effects.folder.Video"] {
            assert!(!project_drag_item(id));
        }
        assert!(project_background("project.empty"));
        assert!(project_background("project.freeform"));
        assert!(!project_background("timeline.empty"));
        assert!(effect_drag_item("effects.item.blur"));
        assert!(effect_drag_item("effects.preset.Fade"));
        assert!(effect_drag_item("effects.presetGrid.Warm"));
        assert!(!effect_drag_item("effects.folder.Video"));
        assert!(draggable_item("touch.mediaBrowser.file./clip.mp4"));
        assert!(draggable_item("touch.project.card.12"));
        assert!(!draggable_item("mediaBrowser.entry.folder"));
        assert!(draggable_item("gfxTemplates.item.title"));
        assert!(draggable_item("effectControls.motion.position.keyframe.42"));
        assert!(!draggable_item("effectControls.ruler"));
    }
}
