# Shipping a release

Maintainers only.

Push a version tag (`v0.2.0`, `v0.2.1`, …) and `.github/workflows/release.yml` takes it from there. It builds separate macOS bundles for Apple Silicon and Intel (so each Mac downloads only what it needs) and uploads them to a **draft** GitHub release, along with `latest.json`, the manifest the in-app updater reads. Release notes come from that version's section of [CHANGELOG.md](../CHANGELOG.md).

Publish the draft by hand. Until you do, `/releases/latest/` keeps pointing at the previous release, so nobody gets a half-baked update.

Update bundles are signed with a Tauri updater key. The workflow needs two repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/voidhttp.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password you picked when generating it

The matching public key goes in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
