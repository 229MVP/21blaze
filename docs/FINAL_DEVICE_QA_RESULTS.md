# Version 1.2.0 Final Device QA Results

Living manual-QA log for the **1.2.0** public release. Update statuses as each
test is executed on a physical device or browser. Do not mark **PASS** without
observing the behavior on the target platform.

**Legend**

| Status | Meaning |
|--------|---------|
| **PASS** | Verified on this platform; behavior matches release requirements |
| **FAIL** | Reproducible defect; link issue / commit / screenshot in Notes |
| **NOT TESTED** | Not yet run on this platform |
| **BLOCKED** | Cannot test (missing build, account, network, hardware, or dependency) |

**Build under test:** _(fill: profile, version, build number, date)_

| Field | Value |
|-------|-------|
| App version | 1.2.0 |
| Bundle ID | `com.twentyoneblaze.app` |
| Tester | |
| Test date | |

---

## 1. iPhone

| Test | Status | Notes |
|------|--------|-------|
| Cold startup | NOT TESTED | First launch after install or force-quit; visible UI within 8s; no permanent black screen |
| Warm startup | NOT TESTED | Relaunch from background or second launch same session |
| Home navigation | NOT TESTED | Solo Play, High Scores, Settings, How to Play, Locker/Rewards when enabled |
| Countdown alignment | NOT TESTED | Fire ring + number + GET READY centered on four-lane board |
| Solo gameplay | NOT TESTED | Full timed match; card deal and lane placement |
| Exact 21 | NOT TESTED | Lane clears at 21; scoring and feedback correct |
| Five-card clear | NOT TESTED | Five-card lane clear resolves correctly |
| Bust handling | NOT TESTED | Bust increments bust count; lane resets per rules |
| Multiplier | NOT TESTED | Increases on valid clears; caps at max |
| Pause | NOT TESTED | Pause overlay; gameplay frozen |
| Resume | NOT TESTED | Timer and input restore correctly |
| Background and foreground | NOT TESTED | App backgrounds during match; safe on return |
| Restart | NOT TESTED | Clean new match from confirmation |
| Results | NOT TESTED | Score, multiplier, busts match played match |
| Play Again | NOT TESTED | Starts new match without stale state |
| High Scores | NOT TESTED | Local tab; global when online |
| Settings persistence | NOT TESTED | Force-quit and reopen; preferences retained |
| Sound | NOT TESTED | Toggle persists; gameplay audio respects setting |
| Haptics | NOT TESTED | Toggle persists; lane tap feedback when enabled |
| Reduced Motion | NOT TESTED | Heavy animations reduced when enabled |
| Offline startup | NOT TESTED | Launch with no network; Home reachable |
| Ads | NOT TESTED | TestFlight: Google test units only; no ad during countdown/gameplay |
| Purchase UI hidden | NOT TESTED | No paywall, restore, or dollar prices |
| Ten-match performance test | NOT TESTED | 10 consecutive Solo matches; no lag growth or crash |

**iPhone device:** _(model, iOS version)_

**iPhone summary:** _(PASS / FAIL counts; blockers)_

---

## 2. Android phone

| Test | Status | Notes |
|------|--------|-------|
| Cold startup | NOT TESTED | APK/AAB cold launch; no permanent black screen |
| Warm startup | NOT TESTED | |
| Home navigation | NOT TESTED | |
| Countdown alignment | NOT TESTED | Critical: ring centered on board at 320×800, 360×800, 390×844, 430×932 |
| Solo gameplay | NOT TESTED | |
| Exact 21 | NOT TESTED | |
| Five-card clear | NOT TESTED | |
| Bust handling | NOT TESTED | |
| Multiplier | NOT TESTED | |
| Pause | NOT TESTED | |
| Resume | NOT TESTED | |
| Background and foreground | NOT TESTED | |
| Restart | NOT TESTED | |
| Results | NOT TESTED | |
| Play Again | NOT TESTED | |
| High Scores | NOT TESTED | |
| Settings persistence | NOT TESTED | |
| Sound | NOT TESTED | |
| Haptics | NOT TESTED | |
| Reduced Motion | NOT TESTED | |
| Offline startup | NOT TESTED | |
| Ads | NOT TESTED | Internal build: test ads only |
| Purchase UI hidden | NOT TESTED | |
| Ten-match performance test | NOT TESTED | |

**Android device:** _(model, API level)_

**Android summary:** _(PASS / FAIL counts; blockers)_

---

## 3. Web

| Test | Status | Notes |
|------|--------|-------|
| Cold startup | NOT TESTED | `expo start --web` or exported static bundle |
| Warm startup | NOT TESTED | |
| Home navigation | NOT TESTED | |
| Countdown alignment | NOT TESTED | Ring centered on board; same sizes as mobile where applicable |
| Solo gameplay | NOT TESTED | |
| Exact 21 | NOT TESTED | |
| Five-card clear | NOT TESTED | |
| Bust handling | NOT TESTED | |
| Multiplier | NOT TESTED | |
| Pause | NOT TESTED | |
| Resume | NOT TESTED | |
| Background and foreground | NOT TESTED | Tab switch / minimize |
| Restart | NOT TESTED | |
| Results | NOT TESTED | |
| Play Again | NOT TESTED | |
| High Scores | NOT TESTED | |
| Settings persistence | NOT TESTED | Browser refresh / local storage |
| Sound | NOT TESTED | |
| Haptics | NOT TESTED | N/A or no-op on desktop; mark PASS if gracefully absent |
| Reduced Motion | NOT TESTED | |
| Offline startup | NOT TESTED | Offline after first load |
| Ads | NOT TESTED | Web ad behavior per build config |
| Purchase UI hidden | NOT TESTED | |
| Ten-match performance test | NOT TESTED | |

**Browser:** _(Chrome / Safari / Firefox, version, viewport)_

**Web summary:** _(PASS / FAIL counts; blockers)_

---

## Cross-platform release gate

Mark **1.2.0 READY for store submission** only when:

- [ ] All **BLOCKING** rows are **PASS** on iPhone and Android (web failures may be non-blocking if web is not a store target)
- [ ] Countdown alignment **PASS** on iPhone and Android
- [ ] Cold startup **PASS** on iPhone and Android
- [ ] Purchase UI hidden **PASS** on all tested platforms
- [ ] No open **FAIL** without documented waiver

**Release gate status:** NOT TESTED

**Sign-off:** _(name, date)_
