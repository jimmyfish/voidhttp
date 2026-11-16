mod certs;
mod files;
mod fonts;
mod grpc;
mod http;
mod kafka;
mod net;
mod script;
mod store;
mod sio;
mod ws;

#[cfg(target_os = "macos")]
mod menu {
    use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::{AppHandle, Emitter, Manager, Runtime};

    pub const CLOSE_TAB: &str = "close_tab";
    pub const CLOSE_WINDOW: &str = "close_window";
    pub const CHECK_UPDATES: &str = "check_updates";
    pub const ABOUT: &str = "about";

    /// The stock Tauri menu binds ⌘W to the native "Close Window", which quits a
    /// single-window app. This menu gives ⌘W to "Close Tab" (handled by the
    /// frontend) and moves "Close Window" to ⇧⌘W.
    pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
        let pkg = app.package_info();

        let app_menu = Submenu::with_items(
            app,
            pkg.name.clone(),
            true,
            &[
                // our own About dialog (frontend): the native panel only takes plain text
                &MenuItem::with_id(app, ABOUT, format!("About {}", pkg.name), true, None::<&str>)?,
                &MenuItem::with_id(app, CHECK_UPDATES, "Check for Updates…", true, None::<&str>)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;

        let file = Submenu::with_items(
            app,
            "File",
            true,
            &[
                &MenuItem::with_id(app, CLOSE_TAB, "Close Tab", true, Some("CmdOrCtrl+W"))?,
                &MenuItem::with_id(app, CLOSE_WINDOW, "Close Window", true, Some("CmdOrCtrl+Shift+W"))?,
            ],
        )?;

        // Edit items are what make ⌘C/⌘V/⌘Z/⌘A work inside the webview on macOS.
        let edit = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &PredefinedMenuItem::undo(app, None)?,
                &PredefinedMenuItem::redo(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, None)?,
                &PredefinedMenuItem::copy(app, None)?,
                &PredefinedMenuItem::paste(app, None)?,
                &PredefinedMenuItem::select_all(app, None)?,
            ],
        )?;

        let view = Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?;

        let window = Submenu::with_items(
            app,
            "Window",
            true,
            &[
                &PredefinedMenuItem::minimize(app, None)?,
                &PredefinedMenuItem::maximize(app, None)?,
            ],
        )?;

        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }

    pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
        match event.id().as_ref() {
            CLOSE_TAB => {
                let _ = app.emit("menu:close-tab", ());
            }
            CHECK_UPDATES => {
                let _ = app.emit("menu:check-updates", ());
            }
            ABOUT => {
                let _ = app.emit("menu:about", ());
            }
            CLOSE_WINDOW => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.close();
                }
            }
            _ => {}
        }
    }
}

pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::on_event);

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(http::HttpState::default())
        .manage(grpc::GrpcState::default())
        .manage(ws::WsState::default())
        .manage(sio::SioState::default())
        .manage(kafka::KafkaState::default())
        .invoke_handler(tauri::generate_handler![
            script::run_script,
            http::send_request,
            http::cancel_request,
            grpc::grpc_describe,
            grpc::grpc_invoke,
            grpc::grpc_send,
            grpc::grpc_end,
            grpc::grpc_cancel,
            ws::ws_connect,
            ws::ws_send,
            ws::ws_close,
            sio::sio_connect,
            sio::sio_emit,
            sio::sio_close,
            kafka::kafka_connect,
            kafka::kafka_produce,
            kafka::kafka_seek,
            kafka::kafka_pause,
            kafka::kafka_refresh,
            kafka::kafka_close,
            net::net_configure,
            net::net_test,
            certs::certs_configure,
            certs::certs_inspect_ca,
            certs::certs_inspect_client,
            certs::certs_set_passphrase,
            certs::certs_has_passphrase,
            store::load_state,
            store::save_state,
            store::save_response,
            store::load_response,
            store::prune_responses,
            fonts::list_fonts,
            files::read_text_file,
            files::read_ref_file,
            files::write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running voidHTTP");
}
