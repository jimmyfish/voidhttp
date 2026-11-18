# Contributing to voidHTTP

Thanks for wanting to help. Bug reports, ideas and pull requests are all welcome. Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs:** open an issue with the voidHTTP version (Settings > Updates), your macOS version, what you did, what you expected, and what happened. If you can, attach a minimal request or a small export (`.voidhttp.json`) that shows the problem. Remove tokens and personal data first.
- **Features:** open an issue before writing a large change, so we can agree on the scope and the UI first. Small fixes can go straight to a pull request.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Principles

Changes should keep voidHTTP what it is:

- **Local first.** No account, no cloud sync, no telemetry, no network calls the user did not ask for (the only exception is the update check, which the user can turn off).
- **Small.** Use the OS webview. Think twice before adding a dependency, on either side.
- **Requests run in Rust.** Networking (HTTP, gRPC, WebSocket, Socket.IO, Kafka, MQTT, Pub/Sub, DNS, proxy, TLS) lives in `src-tauri/src/`. The webview prepares requests and shows results.
- **Imported data is untrusted.** Anything that comes from a file, URL or paste (Postman, OpenAPI, HAR, cURL) must not be able to read local files, choose what gets uploaded, or slip secrets into an export. See "Imports are treated as sketchy by default" in the README.
- **Secrets stay out of plain JSON.** Passphrases go to the macOS Keychain; exports blank secret values by default; saved examples mask tokens and personal data.

## Setup

Prerequisites: [Rust](https://rustup.rs), [Bun](https://bun.sh), and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/). On macOS, the Xcode Command Line Tools are enough.

```sh
git clone https://github.com/jimmyfish/voidhttp.git
cd voidhttp
bun install
bun run tauri dev
```

The app reads and writes its data in `~/.config/voidhttp/`. Back that folder up before you test changes to persistence or migrations.

## Checks

Run these before opening a pull request:

```sh
bun run typecheck                 # TypeScript
cd src-tauri && cargo test        # Rust unit tests
```

Live tests that need the network (for example the gRPC test against grpcb.in) are skipped by default. Run them with `cargo test -- --ignored live_`. The MQTT and Pub/Sub live tests also need a local broker or emulator: set `MQTT_LIVE=<broker host>` (Mosquitto) or `PUBSUB_LIVE=<host:port>` (the Pub/Sub emulator). The setup is in the comments above the tests in `src-tauri/src/mqtt/tests.rs` and `src-tauri/src/pubsub/tests.rs`.

Add a test when you fix a bug in the Rust side or in parsing code (import formats, cURL, JSONPath, variables, masking).

## Where things live

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the two halves fit together, and the README lists the main files under [Where things live](README.md#hack-on-it). In short:

- `src-tauri/src/`: Rust engines and persistence (`http.rs`, `grpc.rs`, `ws.rs`, `sio.rs`, `kafka.rs`, `mqtt.rs`, `pubsub.rs`, `net.rs`, `certs.rs`, `store.rs`, `files.rs`)
- `src/lib/`: request preparation, variables, protocol clients, masking, themes
- `src/lib/formats/`: import and export
- `src/components/`: UI
- `src/store.ts`: app state (zustand)

## UI changes

voidHTTP has a deliberate look (soft edges, Lucide icons only, row actions in "…" menus, bordered settings lists). For new screens or visible changes:

1. Sketch the change first. The static previews in `.hallmark/preview/` use the same CSS tokens as the app; extend one or add a screenshot or mockup to the issue.
2. Agree on the design in the issue.
3. Then change `src/`.

Keep colours in tokens (`tokens.css`), use `lucide-react` for icons, and check both light and dark themes.

## Code style

- Follow the style of the file you are editing. Don't reformat code you are not otherwise changing; it buries the real change in the diff.
- Comments explain *why*, in plain sentences. Don't restate what the code does.
- Keep user-facing text short and plain: say what happened and what to do next.
- Don't add `any` in TypeScript without a reason in a comment.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`, `chore: …`, `ci: …`. A scope is optional, for example `feat(grpc): …`.
- One topic per pull request. Describe what changed, why, and how you tested it. Add screenshots for UI changes.
- Update the README when you add or change a feature, and add a line under the unreleased version in [CHANGELOG.md](CHANGELOG.md).
- Don't bump versions or edit release workflows in a feature pull request; releases are cut by the maintainer.

## AI agents

The repository has a graphify knowledge graph in `graphify-out/`. Agents should read `AGENTS.md` first. If you change files outside Claude Code, run `graphify update .` so the graph stays current. Commit the updated `graphify-out/` files with your change.

## License

voidHTTP is licensed under the [Apache License 2.0 with the Commons Clause](LICENSE): free to use, modify and share with credit to this repository, but not to sell. By submitting a contribution, you agree that it is licensed under the same terms (Apache License 2.0, section 5).
