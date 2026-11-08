//! Fork identity. Restricted upstream trademark artwork is not embedded in FCDroid.

/// The wordmark for a dark (`dark = true`) or light UI: light ink on dark themes. Its aspect
/// ratio is width / height of the returned texture.
pub fn wordmark(_ctx: &egui::Context, _dark: bool) -> Option<egui::TextureHandle> {
    None
}

/// Draw the wordmark `height` points tall with its left edge at `left_center` (vertically centred).
/// Returns the drawn rect.
pub fn paint_wordmark(ui: &egui::Ui, left_center: egui::Pos2, height: f32, dark: bool) -> Option<egui::Rect> {
    let color = if dark { egui::Color32::WHITE } else { egui::Color32::BLACK };
    let r = ui.painter().text(left_center, egui::Align2::LEFT_CENTER, "FCDroid", egui::FontId::proportional(height), color);
    Some(r)
}
