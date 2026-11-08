//! Do not require 8192-pixel textures from a 4096-pixel Android WebGL2 adapter.

pub(crate) fn web_options() -> eframe::WebOptions {
    let mut options = eframe::WebOptions::default();
    if let eframe::egui_wgpu::WgpuSetup::CreateNew(setup) = &mut options.wgpu_options.wgpu_setup {
        setup.device_descriptor = std::sync::Arc::new(|adapter| eframe::wgpu::DeviceDescriptor {
            label: Some("FCDroid presentation device"),
            required_limits: eframe::wgpu::Limits { max_texture_dimension_2d: adapter.limits().max_texture_dimension_2d.min(16384), ..adapter.limits() },
            ..Default::default()
        });
    }
    options
}
