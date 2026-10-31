# Firebase transport regression

`firebase-transport.cjs` runs the actual Firebase 12.10.0 browser SDK in Chromium, with production CSP headers. A local simulated RTDB protocol responds to long-poll requests; it never connects to a real Firebase project, uses no credentials and changes no real data. It reads a room list and saves Charlotte/Discord linking requests in both mobile and desktop contexts.

Install test tools outside the repository:

```sh
npm install --prefix /tmp/gremory-browser-tools --ignore-scripts firebase@12.10.0 playwright-core
```

Run with an installed Chromium binary:

```sh
PLAYWRIGHT_MODULE=/tmp/gremory-browser-tools/node_modules/playwright-core FIREBASE_TEST_MODULES=/tmp/gremory-browser-tools/node_modules CHROMIUM_PATH=/usr/bin/chromium node tests/browser/firebase-transport.cjs
```

Add `EXPECT_BLOCKED=1` to reproduce the previous CSP: it rejects Firebase long-poll scripts, no request reaches the simulated server and the operation times out. The normal run must complete reads and both writes, with no CSP errors. Long polling is forced only inside this regression test; production retains both SDK transports. The test does not verify production credentials, Firebase rules, or the user's physical phone/Wi-Fi.
