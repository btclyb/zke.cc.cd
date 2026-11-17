# EdgeLens

Zero-dependency Node.js HTTPS availability monitor, paired with a browser dashboard. This service does not relay user traffic.

## Run

Node.js 22: `npm start`. Listens on `PORT` or 3000. Routes: `/` dashboard; `/tools/` local utility page; `/api/status` observation state; `/addresses.txt` plain address list; `/api/getADDAPI` JSON address list.

## Measurement

Every 30 minutes while the process is running, select 24 unique IPv4 candidates inside Cloudflare official ranges. Two concurrent workers make two HTTPS requests per candidate to `/cdn-cgi/trace` with SNI/Host `www.cloudflare.com`, full certificate verification, 3-second deadline and response size cap. Only two successful responses qualify for export. Rank by mean response-header time, including TLS setup. Report returned `colo`; do not infer a geographic region from IP ownership.

Results reflect the Abasthan instance network, not the visitor's connection, throughput or edgetunnel tunnel availability. IPs are entrance candidates, not PROXYIP. No UUIDs, credentials or node links are collected. No arbitrary target input is accepted.

State/history are in process memory; sleeping pauses updates and restarting clears history. Exports return 503 until a fresh qualifying result exists and after results are older than 60 minutes. No keepalive automation is configured.

## Cloudflare dashboard

The main branch contains `/edge/index.html` and the fixed-route relay `functions/edge-api/[[path]].js`. The relay only reads the three fixed monitoring APIs from the Abasthan service; it cannot proxy arbitrary hosts. The original `/tools/` site remains available.

## Format

`IP:443#remark`, one entry per line. JSON: `{ "success": true, "data": ["IP:443#remark"] }`, matching the address-entry shape in the upstream edgetunnel public demo. This is an address list, not a complete client subscription. Verify integration in the user's own deployed version.

Sources: https://www.cloudflare.com/ips-v4 ; https://github.com/cmliu/edgetunnel ; https://github.com/EDT-Pages/EDT-Pages.github.io .
