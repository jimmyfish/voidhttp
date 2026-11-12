mod fonts;
mod http;
mod store;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(http::HttpState::default())
        .invoke_handler(tauri::generate_handler![
            http::send_request,
            http::cancel_request,
            store::load_state,
            store::save_state,
            fonts::list_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running voidHTTP");
}
