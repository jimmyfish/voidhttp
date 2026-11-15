# Security policy

voidHTTP stores API credentials, imports files from other tools, and holds TLS client keys and their passphrases. Please report security problems so they can be fixed before they are made public.

## Supported versions

Only the latest release gets security fixes. The app checks for updates on its own (Settings > Updates), so most users get a fix as soon as it is published.

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through GitHub instead: open the repository's **Security** tab and choose **Report a vulnerability**.

Please include:

- the voidHTTP version and macOS version
- what an attacker controls (an imported file, a server response, a URL…) and what they gain
- steps or a minimal file that reproduces it

You should get a first reply within 7 days. Once a fix is released, the advisory is published, and you are credited unless you ask not to be.

## Scope

voidHTTP runs locally and has no server. These are in scope:

- **Imported data.** A Postman, OpenAPI, HAR, voidHTTP or pasted cURL / grpcurl import that can read local files, choose what gets uploaded, run code, or survive into an export with secrets that should have been blanked.
- **Server responses.** A response, gRPC message, WebSocket frame or Socket.IO event that can run script in the webview, or crash or hang the app in a way the size guards should prevent.
- **Secrets at rest and in exports.** Credentials written somewhere other than intended (for example, a client-certificate passphrase outside the Keychain), or masking and secret blanking that leave a value in place.
- **TLS and network settings.** Certificate verification skipped when it should not be, a client certificate sent to the wrong host, or DNS and proxy settings silently ignored.
- **Updates.** Anything that lets an unsigned or tampered update install.

These are out of scope:

- Someone who already has access to your user account or your `~/.config/voidhttp/` folder. Workspace data is plain JSON by design.
- Requests that you deliberately send to a server you chose, with "Skip TLS verification" turned on.
- The first-install Gatekeeper warning. The app is ad-hoc signed, which is documented in the README.

## How voidHTTP protects your data

- All networking runs in Rust. The webview never opens connections itself.
- Workspace, history and stored responses are plain JSON in `~/.config/voidhttp/`. Nothing is sent to any cloud service, and there is no telemetry. The only network call the app makes on its own is the update check, which can be turned off.
- Client-certificate passphrases are stored in the macOS Keychain. Certificate files are referenced by path, never copied.
- Exports blank secret values by default. Saved examples mask tokens, cookies and personal data.
- Imported files are treated as untrusted. See "Imported files are treated as untrusted" in the [README](README.md).
