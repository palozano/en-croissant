# Downloads and VPNs

Investigation: 2026-10-16. Scope: native engine, game database and puzzle database downloads (`src-tauri/src/fs.rs`).

No VPN detection, VPN blocking or explicit proxy bypass exists in this path. It uses reqwest 0.12 with the default TLS/proxy configuration. A VPN compatibility failure has not been reproduced; no controlled VPN-on/off comparison was performed.

## Confirmed issues and changes

Previously the HTTP client had no connection/read timeout and transfers could not be cancelled. A stalled connection could therefore leave the download waiting indefinitely. Database and puzzle callers also ignored command errors, leaving their buttons busy after failures.

Downloads now have a 30-second connection timeout and a 60-second read inactivity timeout (not a total download deadline). An X button interrupts both waiting for the HTTP response and receiving its body. Partial bytes are now saved to disk with resume metadata (see below). Cancelling retains them for a later attempt; incomplete files are never installed as databases. Cancellation ends when extraction/installation starts. Failed/cancelled attempts reset the button and can be retried; cancellation does not display an error notification.

## VPN-related possibilities, not confirmed causes

A VPN or its associated proxy/filter can change routing, DNS or TLS handling. GitHub documents firewalls, proxies and network configuration as common connectivity causes. A source that fails only with a VPN needs a comparison of the exact URL and its redirect destinations with the same app version and VPN on/off. Record the HTTP status or TLS/DNS/timeout error; a browser succeeding does not alone establish that a native app uses the same proxy/trust configuration.

The existing certificate exception is limited to two legacy Komodo URLs; redirects are disabled for those URLs. Other downloads retain certificate verification. This investigation does not expand that exception.

Sources:
- [reqwest 0.12 ClientBuilder: connection/read timeouts and proxy configuration](https://docs.rs/reqwest/0.12/reqwest/struct.ClientBuilder.html)
- [GitHub connectivity troubleshooting](https://docs.github.com/en/get-started/using-github/troubleshooting-connectivity-problems)

## Lumbra's Gigabase throughput investigation (2026-10-16)

The live catalog at `https://www.encroissant.org/databases` points to
`https://db.encroissant.org/LumbrasGigaBase2025-06.db3`, a **2,789,040,128-byte**
uncompressed SQLite file (about 2.79 GB / 2.60 GiB). It is hosted by En Croissant,
not downloaded directly from Lumbra's website.

Three sequential, bounded curl probes on this machine, writing to `/dev/null`:

| Request | HTTP status | Bytes received | Duration | Average bytes/s |
| --- | --- | ---: | ---: | ---: |
| HTTP/2, range 0–16777215 | 206 | 14,257,721 | 15.001 s | 950,441 |
| HTTP/1.1, range 16777216–33554431 | 206 | 13,287,406 | 15.001 s | 885,758 |
| Normal GET, no range | 200 | 6,934,190 | 10.002 s | 693,262 |

These probes intentionally used `--max-time` and stopped before completing the
file. Curl exit 28 here reflects that test deadline, not an observed server timeout.
No full 2.79 GB download was performed. Reproduction example:

```sh
curl --max-time 15 --range 0-16777215 --output /dev/null \
  --write-out 'status=%{http_code} bytes=%{size_download} seconds=%{time_total} bytes_per_second=%{speed_download}\n' \
  https://db.encroissant.org/LumbrasGigaBase2025-06.db3
```

The normal GET response reported `server: cloudflare`, `cf-cache-status: DYNAMIC`,
`content-length: 2789040128`, and `accept-ranges: bytes`. The range probes returned
206, confirming range support. The observed speed was roughly **0.69–0.95 MB/s**
(decimal), independently of the app. At a constant rate in that range the full
file would take approximately **49–67 minutes**; this is an extrapolation, not a
completed-download measurement. Switching between HTTP/2 and HTTP/1.1 did not
show a decisive improvement in these short sequential samples.

Cloudflare's documentation does not list `.db3` among default cached extensions
and lists a 512 MB cacheable-file limit for Free/Pro/Business plans. Both facts
make origin delivery plausible for this file, consistent with `DYNAMIC`, but the
site's plan and cache rules are unknown. **This is not evidence of an explicit
bandwidth cap.** Origin throughput, congestion, routing and VPN/proxy effects
cannot be separated with these measurements alone. macOS `scutil --nc list`
reported the configured ProtonVPN and Tailscale services as disconnected when
checked; that inventory is not proof that no other tunnel/proxy is in use, and no
controlled VPN-on/off benchmark was performed.

App findings:

- No sleep, bandwidth limiter or fixed bytes/s cap exists in the transfer loop.
  The 30-second connection and 60-second read-inactivity timeouts do not impose a
  throughput cap on a connection that continues delivering data.
- Previously every received chunk emitted a Tauri event and caused UI progress
  updates. Downloads now publish at most four progress/speed events per second,
  while network reads continue immediately. A one-second heartbeat updates the
  sampled speed during stalls, even without a known Content-Length. Speed is the
  bytes received in the latest sampling window divided by its elapsed time.
- At the time of these measurements the entire file was accumulated in a Vec,
  requiring at least 2.79 GB of payload in RAM plus allocation overhead. This was
  a potential performance problem, not a demonstrated cause of the measured
  network speeds. The resumable downloader below replaces that buffering with
  incremental disk writes, including for archives.
- Downloads still use one response stream with no range parallelism. Resume
  support has since been added. Parallelism might help a per-connection bottleneck,
  but no such cap has been established and no parallelism was added.

Next useful diagnostic: compare the displayed app rate with a bounded curl GET
at the same time/network conditions (run sequentially to avoid competing for
bandwidth), then repeat with VPN on/off if needed. Confirming a server-side cap
would require the hosting configuration or measurements from another network.

Additional source: [Cloudflare default caching behavior and cacheable size limits](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/).


## Resumable downloads

Transfers now write a `.part` file and JSON metadata under a hidden
`.schaak-downloads` directory next to the destination (inside the extraction
directory for archives). The metadata stores the source/final URL, destination,
HTTP validator and expected byte length; bearer tokens are never stored. Partial
files survive cancellation, connection failures and app restarts.

A retry uses the actual on-disk length with `Range: bytes=N-` and `If-Range`.
Only a strong ETag, or a Last-Modified date established as strong by the response
Date, permits appending. The downloader checks 206 status, the starting byte,
range length, total, resolved URL and validator before appending. A full 200
response replaces the partial file. Changed/invalid ranges restart from zero;
missing or weak validators also require a fresh transfer. A 416 only completes a
local file if its size and current remote validator both match. Encoded responses
are rejected so byte offsets always refer to the saved representation.

Transient network/body errors, 429s and server errors receive up to three automatic
retries with 1, 2 and 4 second delays. Exhausting retries retains the partial data:
pressing the same install/download button later checks it and resumes safely.
Cancellation remains immediate during transfer or retry backoff and also retains
the partial data. A server without safe resume support can still be downloaded,
but must start fresh after interruptions.

A complete raw file is moved to its destination only after its expected size has
been checked and disk writes synced. Archives are read/extracted from the complete
on-disk file. Successful installation removes the sidecars. Incomplete `.part`
files do not appear in the database lists. Logs report resume offsets, automatic
retries, safe restarts and ordinary transfer progress.

Protocol reference: [RFC 9110, If-Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5).
