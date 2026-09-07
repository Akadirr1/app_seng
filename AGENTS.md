# KOÜ Yazılım Kulübü — agent notes

Expo SDK 57 / React Native 0.86 / expo-router. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing any code — Expo has changed.

## Layout

- `app/` — expo-router routes. `app/(tabs)/` holds the four root screens plus a custom
  tab bar; everything else is a stack route.
- `src/theme.ts` — the only place colours, gradients, fonts, radii and spacing live.
- `src/data.ts` — types, fixed lists and the offline fallback. Content lives in
  Firestore; the admin panel writes it.
- `src/store.tsx` — registrations and notification prefs, persisted via AsyncStorage.

## Conventions

- Use `Txt` / `PixelTxt` from `src/components/ui.tsx` instead of raw `Text`. React Native
  does not synthesise font weights, so every weight is its own family name.
- Press Start 2P (`fonts.pixel`) is for badge labels, group headings, empty states and
  loading copy only — never body text, forms or buttons.
- Gradients are non-empty tuples (`GradientStops`). Pass `gradients.*` straight to
  `LinearGradient`; do not cast to `string[]`.
- UI copy is Turkish. Use `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')` for case
  changes so dotted/dotless İ/ı behave.

## Checks

`npm run typecheck` must pass. `npx expo export --platform ios` catches bundling and
import errors without needing Xcode.

## Agent setup

Three layers, and only one of them lives in this repo:

- **MCP servers** — account level (claude.ai → Customize → Connectors). Nothing to copy;
  they are just there. On 21st.dev: `search` and all listing/metadata calls are free and
  unlimited, but **`get_component` is metered — 2 code pulls per day on the free tier**.
  Search widely, spend a pull only on a component actually being built. `get_theme`
  returns CSS free, but treat pulled themes as structural reference only, never as a
  palette source — the palette is `src/theme.ts`.
- **Account skills** — `~/.claude/skills/synced/`. Downloaded per container. Do not copy
  them here.
- **This repo** — `.claude/`, below. This is the part that is version controlled.

```
.claude/
├── settings.json              registers the SessionStart hook
├── hooks/session-start.sh     restores graphify (must stay executable)
└── skills/
    ├── NOTICE.md              provenance and licence boundary — read before citing it
    ├── native-core.md         standing directive, loaded every session
    ├── investigate-first/     diagnose before editing
    ├── lean-build/            new feature, smallest correct size
    ├── surgical-patch/        bug fix, narrowest responsible layer
    └── verify-and-stop/       prove the acceptance conditions, then stop
```

Repo-level skills load automatically — no install step, no network call, which is why
they are committed rather than installed. The hook exists because the cloud container is
rebuilt every session and graphify is the one thing it does not keep.

`graphify` maps the codebase into a queryable graph instead of re-reading it. It was
written from scratch here, so for a while there was nothing foreign to map — that stopped
being true once the admin panel, the event schema and the notification layer arrived.

**The graph is per-session and `graphify-out/` is gitignored.** The container is rebuilt
every time, and a committed graph would go stale the moment the code moved — a stale graph
is worse than none, because it describes a structure that no longer exists with complete
confidence. Rebuild it instead:

```
/graphify .
```

Three things worth scoping out when you do: the `assets/*.png` icons (the skill spends one
subagent per image and they say nothing about architecture), `.claude/skills/*` (agent
discipline prose, not part of the app), and **`design-source/`**. That last one is not
obvious and cost a rebuild to learn: it is a design-tool export kept for reference, not
shipping code, and its two bundled scripts took 121 of 597 nodes — a fifth of the graph —
and pushed `ImageSlot`, `get()` and `createRuntime()` above `useAppStore()` and
`useContent()` in the god-node ranking. The graph names the wrong centres unless it is
excluded.

`AGENTS.md` and `README.md` are worth keeping — they carry the data-flow description the
code alone does not state. Expect roughly a third of the doc-derived edges to dangle;
the AST half is deterministic and trustworthy, the prose half is not.

**Once it exists, questions about architecture, file relationships or project content are
graph queries first (`graphify query`, `path`, `explain`), file scans second.**

## Working rules

- **Do not open subagents** unless the task is large and genuinely parallel. They re-read
  everything and burn tokens.
- **Do not run workflows or deep research** unless asked for by name.
- **Do not publish artifacts.**
- **Do not work around the environment's network policy.** If something is unreachable,
  say it is unreachable. Never assert an outcome you did not observe.
- **Keys:** only publishable/anon keys reach the app; service-role and Supabase secret
  keys never do. **Both `.env` and `.env.local` are gitignored** — the line that called
  `.env` "committed" was wrong, and nothing has ever been committed to it. Either file
  is safe; `.env.local` wins where they overlap, matching Expo. Server-side entry points
  go through `scripts/load-env.ts`, because `import 'dotenv/config'` reads only `.env`
  and silently ignores `.env.local`.
- **An assertion that cannot fail is worse than no assertion** — it reports green. When
  you add a check, break the thing it guards and watch it go red before trusting it.
- Add `check:*` scripts to `package.json` when the first regression appears, not before,
  and start with the assertion that catches that regression.

## Load-bearing decisions — the why log

When a non-obvious bug is fixed, the **reason** goes here next to the rule, not just the
fix. The test: would a session with no memory of this one make the same mistake? If yes,
it belongs here. **A mistake made twice has earned a line in this file.**

- The graphify package is `graphifyy` — **two y's** — while the command is `graphify`,
  one y. Get it wrong and `uv tool install` fails silently and `/graphify` never appears.
- `graphify install` is a **separate step** from installing the package. The package
  provides the binary; that command is what registers the skill with the session.
- `$HOME/.local/bin` must be on `PATH` or the install succeeds and the command is still
  not found. The hook appends it to `CLAUDE_ENV_FILE` so later shells inherit it.

### From the 1.1.0 release

- `ios.deploymentTarget` is a **minimum**, not a maximum. It was once set to `18.7.8`
  under a commit titled "lower iOS deployment target", which would have limited the App
  Store listing to devices running 18.7.8 or newer. Leave it unset unless there is a
  specific reason; the SDK default is the right answer.
- **A comment describing behaviour is not behaviour.** `Registration.synced` carried
  "`syncPending()` retries these" for months. `syncPending` had never been written —
  grep found the name in that one comment and nowhere else, and offline registrations
  were silently lost. When a comment names a function, check that it exists.
- Taking demo data out of `defaultState` does **not** take it off anyone's device. It is
  already in AsyncStorage on every install that ran the old build, so removing seeded
  state needs a migration in the hydration path too.
- `npx expo prebuild` rewrites `package.json` scripts to `expo run:android` / `expo
  run:ios` **every time it runs**. This project builds on EAS, not locally — revert
  those two lines after any prebuild.
- `android.blockedPermissions` does not delete the permission from the generated
  manifest; it adds `tools:node="remove"` and the Android manifest merger drops it at
  build time. Grepping the source manifest will show the permission still present and
  look like a failure. Check for the marker, not the absence of the line.
- `eas` commands act on the directory you are standing in. `eas project:info` prints the
  EAS project, not the bundle identifier — the identifier lives in `app.json` and is
  never configured in EAS. Confirm the project before any command that writes state;
  running one in the wrong repo targets a different app entirely.
- A notification icon renders at 24dp. The full three-line club wordmark turns to grey
  mush at that size; only the `KOÜ` line survives. Generate candidates and downscale
  them before choosing — this is not judgeable at full resolution.
- **In `startsAt` the wall-clock fields are the meaning; the offset is only carried.**
  `buildEvent` reads `2026-03-12T18:00` literally and derives every visible string from
  it, so the offset never reaches the screen. When the admin form became date + time
  pickers, `splitLocal` first *converted* a stored `…T15:00:00Z` to its +03:00 instant —
  which looks obviously right and silently changed the time the calendar showed. Split
  literally, restamp `+03:00` on save: nothing visible moves and the reminder stops
  firing at a different moment than the one on screen. The check that catches this is
  "değiştirmeden kaydet oynatmıyor" in `check:schema` — it builds an event, splits it,
  rebuilds it and compares every derived field.
- The panel's form CSS listed input types by hand (`input[type=text], input[type=password]`),
  so `date`, `time` and `number` fell through to browser defaults and sat visibly smaller
  than everything around them. It is now `input:not([type=checkbox])` — enumerate the
  exception, not the members.
- **`firestore.rules` in the repo does nothing.** Firestore reads its rules from the
  project, not from git, so an unpublished file leaves the Firestore default in force —
  and that default denies everything. The app said `Missing or insufficient permissions`
  while the rules file sat there looking correct, which it was. `service-account.json`
  is unrelated: it is the panel's Admin SDK key, and the app never touches it — the app
  is an unauthenticated client and the rules are the only thing standing between it and
  the data. Publish with `npm run rules:deploy`; no local check can tell you what is
  live, only that a rule was written at all.
- **The archive was never separate data.** `ArchiveEntry` was `{title, date, cat, year,
  count}` — every field except `count` already existed on `ClubEvent`, so a second
  collection meant entering the same real event twice and letting the two drift. It is
  now the past half of one `events` list (`splitByDate`), and `count` turned out to be a
  *photo* count, not attendance.
- **When a number is on screen, find the thing that produces it.** The archive header
  read "2023'ten bugüne 38 etkinlik · 412 fotoğraf" and each card claimed "24 foto",
  behind a four-photo lightbox. There is no photo storage anywhere in this app — all
  four slots were the same gradient placeholder and 412 counted nothing. Fiction with a
  UI around it is much harder to spot than fiction in a variable.
- **A retry is only safe if every write in it is idempotent.** `pushRegistration` was
  fixed to `setDoc(registrations/{regId})` so a resend lands on the same document — and
  then the seat count was almost added as `increment(1)` in the same batch, which would
  have reopened the identical hole one field over: the batch is atomic, but a resend
  after a lost `synced` flag runs it again. The count is a list of registration ids
  written with `arrayUnion`, which ignores an id it already holds.
- A Firestore rule that denies `create` on a document the client writes with
  `set(..., {merge: true})` does not degrade — it fails the whole write. `eventSeats`
  docs are born in the panel, but an event predating them would have had *no* student
  able to register, so the rule allows a first-seat create against an existing event.
- **A document id can carry a uniqueness rule that no query can.** One student number
  per event is enforced by making the registration's id `eventId__studentNo`: a second
  device writing the same student hits an existing document, and the rule only lets a
  write through that changes nothing but `createdAt`. No count, no read, nothing to race
  against — but the id is now personal data, so what goes in the public seat list is a
  separate random token.
- `set()` on a document that already exists is an **update** to Firestore rules, not a
  create. `allow create` alone therefore rejects the very retry that `setDoc` exists to
  make safe, and the registration retries forever getting denied every time. The narrow
  `affectedKeys().hasOnly(['createdAt'])` update branch is what lets an identical resend
  through while still refusing a different one.
- **Only retry what a retry can fix.** `permission-denied` is a rules decision and will
  be the same next launch, so it stops the background retry and surfaces a manual one
  instead of burning a write per app open behind a "Gönderiliyor…" that never resolves.
- Grepping `firestore.rules` as one string finds a line in *some* block, not the block
  you meant. Deleting the retry branch from `registrations` left the check green because
  `raffleEntries` still had the identical line — `rulesBlock()` in `check:release` slices
  one block out before matching.
- **Firebase Cloud Storage costs money on any project created after 2024** — the
  default bucket needs Blaze, and the config's `storageBucket` value is a computed name
  that appears whether or not a bucket exists. Event photos live in Supabase Storage
  instead; Firestore stays where it is. The app never touched a storage SDK — it renders
  a URL — so swapping providers was one file.
- **A release build has no console.** `isFirebaseConfigured` being false is always a
  broken build — `EXPO_PUBLIC_*` is inlined at build time, so a missing EAS environment
  variable means the app connects to nothing. It only logged, so the app opened empty
  and silent; in a store build there is no way to see why. It sets `error` now, which
  puts `ContentNotice` on screen.
- EAS environment variables belong to an environment (production/preview/development).
  Every build profile in `eas.json` names its `environment` explicitly rather than
  relying on a default — the failure mode of guessing wrong is a store build with no
  configuration at all.
- **Metro's transform cache survives an `.env` change.** Measuring whether
  `EXPO_PUBLIC_*` values are inlined gave "not in the bundle" three times, because
  earlier exports in the same session had run with no `.env` and the transformed module
  was cached. `npx expo export --clear` reversed the answer. Any measurement of what a
  build contains has to clear the cache first, or it measures an older build.
- **`.env.local` is an Expo convention, not a dotenv one.** `import 'dotenv/config'`
  loads `.env` and nothing else, so a key placed exactly where the docs said belongs
  produced no error at all — just an undefined variable and a panel that did not work.
  `scripts/load-env.ts` loads `.env.local` then `.env`; dotenv does not overwrite what
  is already set, so first-loaded wins.
- **One failed read inside `Promise.all` blacks out everything beside it.** `fetchContent`
  fetched events, raffles and `eventSeats` together; the seat rule was not published yet,
  so the whole app opened empty with "Missing or insufficient permissions" while the
  events were perfectly readable. Seat counts are an enrichment — they are fetched
  separately now and their failure only costs the remaining-seat line.
- A publishable Supabase key in the panel's secret slot fails as
  `row-level security policy`, which never names the actual cause. The key type is
  visible in the value itself — `sb_publishable_` prefix, or `role: anon` in a legacy
  JWT payload — so the panel refuses before the first request instead of relaying a
  message about policies.
- **An error branch you never triggered is a branch you never wrote.** The panel's
  "Storage bucket not found" message matched `err.code === 404`; gaxios 6 puts the
  number in `err.status` and leaves `code` unset, so the branch never ran and the
  operator kept seeing the generic page. It was written from the shape of the error I
  assumed, never from one I had seen. `check:panel` now carries the real object out of a
  panel log — the same way `check:html` carries real announcement bodies.
- **A field the form stops showing is a field the form stops sending.** The archive
  form hides capacity and the badge because they mean nothing for an event that
  already happened — and saving would then have wiped both. They are rendered as
  hidden inputs instead, and `check:panel` asserts the values survive.
- **Upload after validating, never before.** A rejected form that has already written
  its files leaves objects in Storage that no event points at — quota is paid for them
  and nobody ever notices. The panel validates, then uploads, and deletes what it
  uploaded if the second build fails.
- `makePublic()` throws on a bucket with uniform bucket-level access, which new Firebase
  projects turn on by default. The download URL with a `firebaseStorageDownloadTokens`
  metadata value works under both settings and does not make the bucket listable.
- A multer `fileFilter` that answers `cb(null, false)` **drops the file silently**: the
  event saves, the operator believes the photo uploaded, and it is nowhere. Pass an
  error instead, and translate multer's codes — an unexplained "Bir şeyler ters gitti"
  after picking seven photos tells the operator nothing.
- **A check that reads comments finds its own rationale.** A guard has now gone red
  against correct code three times because the comment explaining *why* something was
  removed still contains its name — `addDoc`, `increment(1)`, `HOLD_MS`. Strip comments
  before matching source; `check:release` has a `strip()` for exactly this.
- The calendar/archive boundary is **the day, not the instant**. Splitting on the start
  time would move a three-hour event into the archive while it is still running; an
  event stays on the calendar through its own day and moves the next morning. `today`
  comes from `todayLocal`, which reads +03:00 rather than the device clock — a phone
  abroad otherwise archives an event the club still has on today's calendar.
- **`newArchEnabled` was removed from the SDK 57 config schema.** It was valid in 52–53
  and did nothing here — the new architecture is the only one in 57, so the flag turned
  on something already on. A no-op field is invisible until the schema check calls it an
  additional property and fails the EAS build. `check:release` greps `app.json` for it.
- **A version guard's authority is the *installed* `expo`.** Expected versions come from
  `node_modules/expo/bundledNativeModules.json`, so a stale `expo` ships a stale list and
  the guard goes green against yesterday's expectations — locally it passed while
  `expo doctor` on EAS listed eleven mismatches, because the local `expo` was 57.0.12 and
  doctor compared against 57.0.17's list. `expo` is not in its own list, so it is pinned
  separately against the installed version.
- `npx expo install --check` needs api.expo.dev and **the container's proxy blocks it**
  (`HTTP Proxy Network Error: Forbidden`). That is not a reason to type version numbers
  by hand — the npm registry itself is reachable, and api.expo.dev was never where the
  answer lived: every `expo` release carries the list it expects in its own
  `bundledNativeModules.json`. `npm run deps:sync` reads the newest patch of the current
  SDK major from the registry, installs it, then writes that release's list into
  `package.json`. Expo's own major stays put: 57 → 58 is a migration, not a patch bump.
  Run it whenever `paket sürümleri SDK ile uyuşuyor` goes red.
- **A tool that reads its expectations from disk must prove what it read.**
  `deps:sync` takes the expected versions from the installed `expo`'s
  `bundledNativeModules.json`. `git pull` updates `package.json` and leaves
  `node_modules` alone — so the first thing it did on a freshly pulled checkout was
  read *yesterday's* list and rewrite eleven correct versions **backwards**. The fix is
  not a warning: it verifies the installed `expo` is the target before opening the
  list, installs it if not, and re-checks afterwards. The same trap made
  `check:release` print `~57.0.15 ≠ ~57.0.10`, which reads as "the new version is
  wrong"; it now reports the stale `node_modules` instead and says `npm ci`.
- **Every check ran against a tree where `node_modules` already matched.** That is the
  one state a dependency-sync tool never finds in the wild — after a pull, after a
  branch switch, on a colleague's first clone, `node_modules` is behind by definition.
  Test the state the user is actually in, not the state you happen to be in.
- **A successful upload is not a delivered build.** `eas.json` carried
  `submit.production.android.releaseStatus: "draft"`, and a draft release sits in Play
  Console without being distributed to any track — `eas submit` reports success, the
  build is genuinely there, and every tester on the internal track sees "öğe
  bulunamadı". Play needs draft for the *first* upload of an app that has never had a
  release; leaving it there afterwards is a test channel with no testers. `check:release`
  now refuses it, so turning it back on has to be deliberate.
- **TestFlight's "the requested app is not available or doesn't exist" is an App Store
  Connect availability fact, not a build fact.** The EAS xcodebuild log settles the
  build side on its own: `ARCHIVE SUCCEEDED`, zero errors, `beta-reports-active = 1`
  (an entitlement only App Store distribution profiles carry), no `ProvisionedDevices`
  (so not ad-hoc), `get-task-allow = 0`, minimum iOS 15.1. A binary that signs like that
  cannot be the reason a tester cannot install it. Do not go looking in `app.json` —
  export compliance is already answered there, and it produces a "Missing Compliance"
  banner, not this error.
  The reported cause that matches the signature — *visible in TestFlight, notification
  arrives, install fails instantly* — is the app's **Pricing and Availability →
  App Availability** left with countries in `Processing`, which is account-shaped: it
  hits every app at once and survives new builds, which is why it looks like a build
  problem and is not one.
  **But an amber clock on that page is not by itself that state.** The summary shows
  `🕐 1 Available / 🕐 174 Not Available`, which reads like something pending; opening
  the detail shows the per-country status is `Available on App Release`, and that is the
  correct, settled state for an app whose first version has not shipped yet. Reading the
  summary clock as "stuck processing" cost a wrong diagnosis here and nearly cost the
  operator a pointless change to their deliberate single-country setting. Judge it from
  the per-country status, never from the clock. Narrowing availability is also not a
  testing problem in itself: TestFlight has no territory restriction, a tester in any
  territory is eligible. Next is Agreements, Tax and Banking pending account-wide.
  Beyond that it is a known Apple-side bug that only Developer Support clears.
  **Unverified from this repo:** none of it can be observed here — `eas-cli` has no
  credentials in the container and App Store Connect has no read path. Treat the above
  as where to look, not as a diagnosis, and never assert which one it was.
- **EAS's remote version counter and Play's used-code list are two separate ledgers.**
  With `appVersionSource: "remote"`, `autoIncrement` bumps a number EAS keeps for the
  project — initialised from the local config and updated only by EAS builds. It has no
  idea what Play already holds. So a fresh build can auto-increment perfectly and still
  land on a `versionCode` Play has seen, and the error reads as though autoIncrement had
  failed when it did exactly what it promises. `eas build:version:get --platform android`
  shows the counter; `eas build:version:set` moves it above what the store holds. A
  rebuild alone does not fix a counter that is behind — it just burns another number.
- **`releaseStatus` lives in `submit`, so changing it does not need a new build.** The
  artifact is unaffected by anything under `eas.json` → `submit`; only `eas submit` reads
  it. When that setting stranded a build as a draft in Play, the fix was to publish the
  draft already uploaded there (Internal testing → the draft → review → roll out), not
  to rebuild. Saying "the config only affects future submits" invited exactly the
  unnecessary build it was meant to prevent — say which command reads a setting, not
  just when it takes effect.
- **Deploying the panel needs `nixpacks.toml`, and both lines in it are load-bearing.**
  Nixpacks recognises this repo as a Node app and would run `npm start` — which here is
  `expo start`, the mobile dev server. The panel would never come up and the deploy
  would still report success. And the panel's runtime packages (`express`,
  `firebase-admin`, `multer`, `sharp`, `@supabase/supabase-js`, `tsx`) sit in
  `devDependencies`, which is right for the mobile side — Metro never reaches them — but
  the lockfile marks all seven `dev: true`, so an install under `NODE_ENV=production`
  (what Nixpacks sets) skips every one. Both failures land in the same place: the build
  goes green and the container dies on boot with `Cannot find module 'express'`.
  `check:release` fails if either the `--include=dev` or the start command disappears.
- **A session cookie without `Secure` is the deploy turning a local convenience into an
  exposure.** The panel ran on `localhost` for months, where `Secure` would have
  prevented login outright — browsers do not store it over plain HTTP. Put the same
  panel behind Coolify and it holds student names and numbers on the open internet.
  The flag is decided per request from `req.secure`, which needs `trust proxy` because
  a reverse proxy terminates TLS and forwards plain HTTP. `cookieHeader` lives in its
  own module for one reason: importing `server.ts` starts `app.listen`, so nothing in
  it can be asserted without standing a server up.
- **`strip()` knows `//` and `/* */`; `nixpacks.toml` is commented in `#`.** The guard
  above read the raw TOML — and that file explains, in its own comments, both of the
  strings it searches for. Delete the real `--include=dev` and the whole `[start]`
  block, leave the prose describing them, and the check still passed: verified, it did.
  Same trap as the JS one already in this log, one file format over, and it fails the
  more dangerous way round — green against a config that cannot boot. It strips `#` to
  end of line now, counting quotes first, because a `#` inside a command is not a
  comment and truncating there would fail a correct file.
- **`??` does not catch an empty environment variable, and a deploy panel makes empty
  the easy mistake.** `Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 4000)` reads
  0 when `ADMIN_PORT` exists and is blank — `''` is not nullish, so the fallback never
  runs, and `Number('')` is 0. `listen(0)` is not an error: the kernel hands out a random
  free port, the container reports healthy, the log is clean, and the reverse proxy never
  reaches it. This repo's own `.env.example` ships `ADMIN_PORT=` empty under a comment
  promising 4000, so the documented path produced the broken case. The decision lives in
  `resolvePort` (`admin/port.ts`) now — blank, non-numeric, zero and out-of-range all
  fall through — and `check:release` asserts `server.ts` still goes through it, because a
  pure function nobody calls guards nothing.
- **`@types/*` is not auto-included here, so a test runner's globals are invisible
  to `tsc`.** Adding Jest made `typecheck` fail with `Cannot find name 'describe'`
  in every test file while `@types/jest` sat correctly installed in
  `node_modules/@types`. TypeScript normally pulls those in automatically when
  `types` is unspecified, and this config never restricted it — but `tsc
  --listFiles` showed only the `@types` packages something *imports* (express,
  multer, react), never a global one. Whatever `expo/tsconfig.base` does with
  `moduleResolution: bundler` and `customConditions`, the measured behaviour is
  that automatic inclusion does not happen; naming `"types": ["jest"]` fixes it
  and cannot lose anything, because nothing was being auto-included to begin with.
  Diagnose this with `--listFiles`, not by re-reading the config: the config
  looks correct and is not.
- **`@testing-library/react-native` 14 made `render`, `rerender` and `unmount`
  async.** Ported tests written for 13 call them bare, and the failure names
  nothing useful: `render` returns a promise, `screen` is still unbound, and the
  next line throws "`render` function has not been called". Worse is the
  unawaited `unmount()`: the test that forgot it passes, and the *next* test in
  the file fails instead, because cleanup lands in the middle of its render.
  That one cost the longest — the failing test passed in isolation, which is the
  signal to stop reading the failing test and start reading the one before it.
- **A seven-day `gcTime` is a seven-day timer, and Jest waits for it.** After the
  suite went green, `jest` never exited: every test that mounted a real
  `QueryClient` left one `setTimeout` per query, sized to `gcTime`, which
  `createQueryClient` sets to the offline retention window.
  `--detectOpenHandles` reports nothing, because nothing leaked — an ordinary
  pending timer is not a leak. The tell is that a minimal render test exits
  fine while the provider one hangs. Tests own the client they mount and
  `clear()` it afterwards; `--forceExit` would have hidden it and, with it,
  every future real leak.
- **`rescheduleReminders` cancels every scheduled notification, so a second
  scheduler is a silent delete.** The AI Gündem digest needed a daily local
  notification, and adding it as its own scheduler would have worked in
  isolation and failed in place: the next reminder rebuild calls
  `cancelAllScheduledNotificationsAsync()` and takes the digest with it. No
  error, no log — a notification that simply stops arriving, which nobody
  reports as a bug because nobody knows it was due. What gets scheduled is now
  decided in one pure function (`src/notificationPlan.ts`) and the effectful
  half only applies the list.
- **Quiet hours may move a reminder and must not move the digest.** Nobody chose
  03:00 for a reminder — it fell there from the event's own start time — so
  shifting it to 08:00 is a service. The digest hour is picked by hand on the
  settings screen, and moving it means a notification arriving at a time the
  settings screen does not show. Same class as the calendar entry above: the
  wall-clock the user set is the meaning.
- **A hand-written time range in the UI drifts from the constant that enforces
  it.** The notification screen said "23:00 – 09:00 arası bildirim yok" while
  `QUIET_END_HOUR` was 8, so the setting described its own behaviour an hour
  wrong — and nothing could catch it, because the string and the constant never
  met. The label is built from the constants now. Anywhere a screen states a
  number the code also decides, derive it; a copy of a value is a value that
  will disagree.
- **A new dependency turns `git pull` into a broken checkout, and Metro's error
  blames the wrong thing.** After the `@tanstack` packages landed, a fresh pull
  and `npx expo start` failed with `Unable to resolve
  "@tanstack/query-async-storage-persister"` — which reads as "the package is
  missing from the repo", not "your node_modules is behind". It was declared in
  `package.json` and in the lockfile the whole time. The rule "npm ci after a
  pull" was already in this file and still did not help, because nothing checked
  it: `check:release` now lists every declared package that is absent from
  `node_modules` and says `npm ci` outright. Reproduced by deleting exactly that
  package before adding the guard.
- **A ported comment asserting a runtime capability is not evidence the runtime
  has it.** `deviceId.ts` arrived saying `crypto.getRandomValues` is what
  "React Native, Hermes and every browser provide", and on a real device it does
  not exist — the app logged the fallback on every launch and both the device id
  and the Edge idempotency key came from `Math.random()`. Neither needs to be
  secret; both need to be unique, and colliding ids merge two devices into one
  rate-limit bucket. `expo-crypto` is in the SDK's own version list and needs no
  extra native module. When ported code claims a global exists, check the
  runtime, not the comment.
- **A zeroed random source produces a perfectly valid uuid.** With
  `expo-crypto` stubbed (as it is under Jest), `getRandomValues` returns all
  zeros and `randomUuidV4` yields `00000000-0000-4000-8000-000000000000` — which
  passes the v4 shape check, so `isDeviceId` approves it and every install gets
  the SAME identity. The generator now rejects an all-zero draw. The test that
  caught it was already there, asserting only that two ids differ.
- **A client's poll window has to be longer than the server's scheduling
  period.** The enrichment hook polled six times at five seconds and gave up
  after thirty, while the summarisation worker runs on a two-minute cron — so it
  quit before the worker had run even once, and the log said "still queued (no
  reason given)" because there was no reason: the job was waiting its turn.
  Widening a window is done by spacing the polls, not by adding them; each poll
  writes to a per-device rate-limit bucket. The window is asserted against the
  cron period now, and that assertion caught its own arithmetic being wrong
  before the code shipped.
- **`btoa`, `atob` and `Buffer` are all absent under Hermes, and code that
  falls back from one to the other assumes a world with only two runtimes.**
  `cursor.ts` read `typeof btoa === 'function' ? btoa(...) : Buffer.from(...)`,
  which says "browser, else Node". Expo SDK 57 on RN 0.86 is neither: grep the
  whole `react-native` and `expo` trees and nothing installs any of the three.
  Jest hid it perfectly, because Jest *is* Node and always took the second
  branch. The test that catches it deletes the three globals before calling —
  that is the only way to put a Node test runner in the device's world.
- **A regex character class written as `[^a-z0-9]` does not case-fold Turkish,
  it deletes it.** `tileFromSlug` stripped with `/[^a-z0-9]/gi` and then called
  `toUpperCase()`. Measured: `İTÜ Yapay Zekâ` produced the badge `"TY"` — the
  `İ` and `Ü` were removed and the letters that survived came from two different
  words — and `şirket-blog` produced `"IR"`. Testing "is this a letter" by
  asking whether its upper and lower forms differ is engine-independent and
  needs no unicode property escapes, which Hermes does not support reliably.
- **The +03:00 rule belongs to the app, not to the events screen.** The port
  rendered its day line and article dates from `new Date().getDay()` and friends,
  so a phone outside Türkiye showed AI Gündem naming one day while the Takvim
  tab named another, at the same instant. `clubCalendar` now sits beside
  `todayLocal` and both sections read it. Related: "dün" is a calendar word, so
  it is computed from calendar days at +03:00, not from elapsed milliseconds —
  47 elapsed hours can be two calendar days.

### AI Gündem portundan — bir çalışma zamanı, bir de kendi testine saklanan hatalar

- **React Native'in `URL`'i bir ayrıştırıcı değil, bir dize sarmalayıcısı.** Taban
  verilmediğinde girdiyi hiç denetlemeden saklıyor, yani **hiçbir zaman
  fırlatmıyor** — `new URL(raw)` etrafındaki `catch` erişilemez kod. Ölçüldü:
  `addSourceByUrl`'e verilen beş girdinin beşi de `unsupported_source` döndü,
  `https://ornek.com/rss?redirect=https://a:b@c.com` dâhil. `invalid_input`
  dalına hiç girilmiyordu; `protocol` getter'ı şemasız girdide `''` döndüğü için
  "yalnızca https" cevabı çıkıyordu, ve `password` getter'ı
  (`/https?:\/\/.*:(.*)@/`, açgözlü `.*`) yetki bölümünün dışını da tarayıp
  sorgu dizesindeki bir `@`yi kimlik bilgisi sanıyordu. Bir de çökme var:
  `new URL('a#b')` yapıcının içinde `undefined.includes` çağırıyor. Doğrulama
  artık `src/gundem/data-access/sourceUrl.ts`'te, elle: girdi bir dize, çıktı bir
  karar, motor bilgisi girmiyor. **Tarayıcıda ve Node'da doğru olan bir şey
  burada doğru değil — ve Jest Node olduğu için testler bunu göstermiyor.**
- **Yazılmış ama bağlanmamış bir fonksiyon hiçbir şeyi korumuyor; kendi testi
  varsa daha da kötü.** `capPersistedFeed` çevrimdışı önbelleğe 200 haberlik
  sınırı uyguluyordu — kâğıt üzerinde. İki ayrı sebeple uygulamıyordu:
  `dehydrateOptions`ta yalnızca `shouldDehydrateQuery` vardı (kimse çağırmıyordu)
  **ve** fonksiyon `page.data.items`e bakıyordu, oysa gerçek sayfa
  `Page<Article>`, yani `{items, nextCursor, hasMore}`. Birim testinin fikstürü
  de aynı uydurma şekli kuruyordu, o yüzden yeşildi. Grafik sorgusu buldu:
  *"kaynak dosyalarda tanımlı, ama dosya-dışı tek göndergesi kendi testi olan"*
  çağrılabilirler. Sonuç sınırsız büyüyen bir AsyncStorage blob'uydu.
  **Bir testin fikstürü tipten gelmiyorsa, test kodu değil kendini doğruluyor
  olabilir.**
- **Kısma (throttle) bir testi sahte yeşile boyar.** Kalıcılaştırıcı iki saniyede
  bir yazıyor; "blob'da 200'den fazla haber yok" iddiası, `waitFor` ilk anlık
  görüntüyü gördüğü an geçiyordu — o görüntüde zaten 20 haber vardı. Sınır hiç
  uygulanmasa da geçen bir iddia. `persistOptionsFor()` bileşenin dışına alındı,
  test artık `dehydrate()`i sağlayıcının kullandığı seçeneklerle doğrudan
  çağırıyor. **Zamanlayıcının arkasından ölçülen bir sayı, ölçmek istediğiniz
  sayı değildir.**
- **`toLowerCase()` Türkçeyi, `toLocaleLowerCase('tr')` İngilizceyi kaçırıyor —
  ve son arama listesinde ikisi birden var.** Düz küçültme `İstanbul` ile
  `istanbul`u ayırıyor (birleşen nokta); Türkçe küçültme `OpenAI`yi `openaı`
  yapıp `openai`den ayırıyor. Türkçeye geçince mevcut `OpenAI` testi kırmızı
  verdi — deponun kendi kuralını körü körüne uygulamanın bedeli. Kural artık tek
  cümle: **I harfinin noktası bu listede bir arama farkı değil**; dördü de düz
  `i`ye katlanıyor (`searchKey`).
- **Aynı kararı iki yerde uygulamak, ikisinin ayrışmasının tek sebebidir.**
  `pushRecentSearch` listeyi 10'da kesiyordu, `useRecentSearches`'ün iyimser
  kopyası kesmiyordu: ekranda 15 arama, diskte 10, ve fark ancak uygulama
  yeniden açılınca görünüyor. İki taraf da tek bir saf `mergeRecentSearch`
  çağırıyor artık. İkisini ayrı ayrı sınayan iki test bu farkı asla göremez —
  farkı gören test ikisini **aynı** testte karşılaştıran testtir.
- **`.catch`i olmayan bir `.then`, bitmeyen bir iskelet demek.** `useLoaded`
  reddedilen bir okumada `isReady`yi sonsuza kadar `false` bırakıyordu: hata
  yok, log yok, yalnızca yüklenmeyen bir liste — üstüne yakalanmamış bir promise
  reddi. Bugün `kv.ts` her okumayı yuttuğu için dal tetiklenmiyor, ama
  tetiklenmeyen bir dal yazılmamış bir daldır.
- **Bir yorumun adıyla andığı dosyanın var olduğunu kontrol edin.** `hooks.ts`
  aylarca "Measured with the fake PostgREST in `src/__tests__/integration.test.tsx`"
  diyordu; o dosya yoktu. Bu defterde zaten aynısının bir örneği var
  (`syncPending`). Dosya artık var ve o ölçümü gerçekten yapıyor.
- **Grafiği kurarken `docs/` ve `*.md` dışarıda bırakılırsa maliyet sıfır.**
  Semantik çıkarım alt ajan istiyor; AST yarısı istemiyor. `/graphify .` bu
  depoda kod-only koşturulduğunda 111 dosya → 1005 düğüm, 2272 kenar, tek
  LLM çağrısı olmadan. Mimari sorular için yeterli: yukarıdaki "yalnızca kendi
  testi çağırıyor" bulgusu bir grafik sorgusu, dosya taraması değil.

### Cihazdan gelen "çeviri gelmiş ama özet oluşturamıyor" raporundan

- **Bir cevap, elde olan veriyi silemez — en fazla ona ekleyebilir.** Makale
  ekranı "Özet hazırlanıyor" kararını `request-enrichment`'ın cevabına bakarak
  veriyordu: `pending = result?.status === 'queued' || ...`. Satırda üç madde
  dururken uç noktadan gelen bir `queued`, onları dönen bir göstergenin
  arkasında yok ediyordu. Kullanıcının gördüğü tam olarak buydu — çeviri
  ekranda (yani `summary_ready` doğru, yani özet de satırda), özet yok.
  Ekran artık önce **elindekine** bakıyor: `hasSummary(summary)` doğruysa ne
  `pending` ne `unavailable` yazabilir.
- **Bir durum dizesini tanımamak, veriyi atmak için sebep değil.** Depo yalnızca
  `status === 'ready'` gövdesini kabul ediyordu; sunucu özeti başka bir adla
  döndürdüğü an (`already_enriched`, `done`, ne olduğunu buradan göremiyoruz)
  üç madde çöpe gidiyor ve cevap "kuyrukta" oluyordu. Koşul artık şekle bakıyor:
  gövde dolu `summary.bullets` taşıyorsa cevap odur. `unavailable` yine önce
  kontrol ediliyor — sunucu bakıp "gövde yok" dediyse boş bir `summary` alanı
  bunu bozmamalı.
- **Özet ve çeviri iki ayrı üründür; `toSummary` onları birbirine bağlıyordu.**
  `summary_ready` false ise fonksiyon erken dönüp `translationTr: null`
  diyordu — satır bitmiş bir çeviri taşısa bile. Çeviri durumu artık metnin
  kendisinden okunuyor, bayraktan değil: elde Türkçe metin varsa hazırdır.
  Ters yönü de düzeldi — `translation_state: 'ready'` derken metin boşken
  düğme açılıyor, kullanıcı basıyor ve `bodyFor` sessizce orijinale düşüyordu.
- **Teşhis edilemeyen bir uyarı, uyarı değil.** Cihaz logunda sekiz satır vardı
  ve sekizi de aynı cümleydi: "returned an unrecognised body". Sunucunun ne
  döndürdüğünü hiçbiri taşımıyordu, dolayısıyla log elde olduğu hâlde sebep
  bilinemiyordu. Uyarı artık HTTP kodunu, `status` alanını ve üst düzey
  anahtarları yazıyor — gövdenin kendisini değil, içinde makale metni olabilir.
- **İki düzeltme aynı anda girince biri diğerinin testini görünmez kılabilir.**
  "Özeti olan haberde hiç sorma" düzeltmesi devreye girince `result` hiç
  oluşmuyor, ve `pending`in eski (yanlış) ifadesi de artık yanlış cevabı
  veremiyor: ekran testleri **eski kodla da** yeşil kalıyordu. Ölçüldü —
  düzeltme geri alındı, üç test de yeşil verdi. Koruyan test, ikisinin
  ayrıştığı sırayı kuran testtir: özet **yokken** aç, `queued` cevabını al,
  sonra satırı tazele. Her düzeltmeyi tek tek geri alıp kırmızıyı görmeden
  "test ettim" demeyin; birlikte geri almak bu maskelemeyi gizler.
- **Bir uç noktanın gövdesini tahmin etmeyin — fonksiyonun kaynağını okuyun.**
  `request-enrichment`'ın `ready` cevabı maddeleri **`summary_tr`** adıyla
  gönderiyor; istemci `summary.bullets` okuyordu. Alan adı tutmadığı için
  sunucunun her başarılı cevabı "tanınmayan gövde" sayılıp `queued`a
  düşüyordu — özet üretilmiş, kablodan geçmiş, istemcide çöpe gitmişti.
  Backend ayrı bir Supabase projesinde ve buraya bağlı değil, ama kodu
  `Akadirr1/follow-ai`'da ve depo herkese açık: `add_repo` + `git clone` ile
  okundu ve soru bir tahminle değil kaynakla kapandı. Bir tur önce "buradan
  bilinemez" demiştim; bilinebiliyordu.
- **Aynı hata kaynak uygulamada da var.** `follow-ai` kendi Edge
  fonksiyonunun gövdesini kendi istemcisinde yanlış okuyor. Taşınan kod
  taşındığı hatayı da taşır: bir portu "sadakatle taşındı" diye doğru
  saymayın — karşı tarafın sözleşmesini bir kez de kendiniz okuyun.
- **İstemci testinin fikstürü, istemcinin varsayımını doğrular.** Bu
  uyuşmazlığın iki uygulamada birden yaşamasının sebebi buydu: `bullets`
  bekleyen kodun testi de `bullets` gönderiyordu, yeşildi ve hiçbir şeyi
  korumuyordu. Kablodaki şekli sınayan fikstür, kablonun **öbür ucundan**
  kopyalanır.
- **Uzun metnin "txt dosyası gibi" görünmesi bir yazı tipi sorunu değil,
  paragrafın hiç olmamasıydı.** Gövde tek bir `<Txt>` olarak basılıyordu; RSS
  çıkarıcıları kimi kaynakta boş satırla, kimisinde tek satır sonuyla ayırıyor
  ve ekran ikisini de olduğu gibi geçiriyordu. `toParagraphs` her iki biçimi de
  tanıyor **ve** boş satır varken paragraf içindeki tek satır sonlarını boşluğa
  katlıyor — katlamazsa metin, sütun genişliğiyle alakasız yerlerden kırılmış
  görünür. Boş satırı hiç olmayan metinde ise tek satır sonu paragraf
  ayırıcısıdır; o dal atlanırsa metnin tamamı tek bir dev paragrafa iner, yani
  düzeltilmeye çalışılan duvarın aynısı kurulur.
- **Okunabilirlik dört sayının işi, biri değil:** punto (14,5 → 16), satır
  aralığı (1,52 → 1,7), satır uzunluğu (kartın 18 px iç boşluğu ~85 karakteri
  ~60'a indiriyor) ve zemin (beyaz kart, sayfa zemininde yüzen metin değil).
  Yalnızca puntoyu büyütmek satırı daha da uzatır ve durumu kötüleştirir.

### Apple'ın çekiliş reddinden — 5.3.1 / 5.3.2

- **Red mekanikte değildi, beyandaydı.** Uygulama zaten çekiliş çekmiyordu:
  `raffleSchema.ts` aylardır "burada rastgele seçim, tohum, durum makinesi yok"
  diye yazıyor ve doğru yazıyor — form toplanıyor, kazanan panelden elle
  giriliyor. Eksik olan tek şey, bunun **kullanıcıya söylenmesiydi**: düzenleyen
  kim, katılım ücretsiz mi, kazanan nasıl seçiliyor, Apple'ın ilgisi var mı.
  Reddi okuyup koda bakınca ilk refleks mantığı değiştirmek oluyor; değiştirilecek
  mantık yoktu. Guideline 5.3.x'in istediği şeylerin çoğu davranış değil metin.
- **Düzenleyen adı, App Store Connect'teki *takım* adıdır — kişisel Apple Account
  adı değil.** Bu hesapta ikisi farklı yazılıyor: hesap sayfasının tepesinde
  `Abdülkadir İvenç`, Team ID'nin üstünde `Abdulkadir IVENC`. Mağazada
  geliştirici olarak görünen ve Apple'ın beyanla karşılaştırdığı ikincisi.
  Türkçe aksanlı hâli daha "doğru" göründüğü için düzeltmek isteniyor; düzeltmek
  tam olarak reddin sebebini geri getirir. Testte `not.toContain('Abdülkadir')`
  var, ve orada olma sebebi bu.
- **Kurallar sayfası yalnızca kodun gerçekten yaptığı şeyi yazabilir.** "Her
  öğrenci numarası bir çekilişe yalnızca bir kez katılabilir" cümlesi yazılmadı:
  o kural *kayıtlarda* doküman kimliğiyle (`eventId__studentNo`) zorlanıyor ama
  çekiliş katılımının kimliği rastgele (`makeEntryId`) — uygulama ikinci
  katılımı yalnızca aynı cihazda engelliyor. Zorlanmayan bir kuralı resmî
  kurallara yazmak, "412 fotoğraf" satırıyla aynı sınıfta bir kurgu olurdu.
- **Bir bileşenin kendi testi, onu kimsenin ekrana koymadığını göremez.**
  `RaffleNotice` render testleriyle birlikte geldi ve o testler beyan iki
  ekrandan da silinse yeşil kalırdı. Mount edildiğini doğrulayan şey
  `check:release` — dördü de tek tek kırılıp kırmızı verdiği görüldü (etkinlik
  ekranı, form, rota kaydı, Apple cümlesinin birebir hâli). Aynı gerekçeyle
  `raffleLegal.ts` okunurken yorumlar atılıyor: cümleyi yalnızca bir açıklama
  satırında bırakmak kontrolü yeşile boyardı.
- **`@testing-library/react-native` 14'te elle `unmount()` çağırmayın — beklenmiş
  olsa bile.** Depodaki eski kayıt "unmount'u beklemeyi unutma" diyor; ölçülen
  doğru bundan farklı. Her testin sonunda `await unmount()` varken dosyadaki ilk
  render geçiyor, sonraki her render **boş ağaç** buluyordu: kurallar sayfası
  testi tek başına (`jest -t`) yeşil, dosyanın tamamıyla kırmızı. Konsolda tek
  ipucu "overlapping act() calls". RNTL 14 kendi `afterEach` temizliğini zaten
  bekletiyor; üstüne elle sökmek çakışan act() kapsamı üretiyor. **Tek başına
  geçip toplu koşuda düşen bir render testinde önce bir önceki testin
  temizliğine bakın.**

### Arka plan zenginleştirmesi ve yapılandırma görünürlüğü

- **Zenginleştirme talep güdümlü, ve bunu kimse yazmamıştı.** `sync-feeds` her
  15 dakikada bir haberleri çekiyor ama **özet işi kuyruğa koymuyor**; işi
  yaratan tek şey bir istemcinin `request-enrichment` çağırması, ve onu işleyen
  worker iki dakikada bir koşuyor. Sonuç: bir haberi **ilk açan kişi her zaman
  bekliyor** — cihazda görülen "Özet hazırlanıyor, bir dakika sonra geldi" tam
  olarak bu, hız sınırı değil. Hız sınırı 429 ve `rate_limited` döner, `queued`
  değil. Karşılığı akış yüklenirken arka planda ısıtmak: özet sunucuda
  `content_hash`'e göre paylaşıldığı için bir cihazın ısıttığı haber herkes için
  hazır oluyor.
- **Ön yükleme bütçesi tahmin edilemez, sunucudan okunur.**
  `_shared/enrichment.ts`: `request_enrichment_miss` **30/cihaz/gün**,
  `request_enrichment_check` **120/cihaz/saat**. Isıtma yalnızca özeti olmayan
  satırlar için yapıldığından her ısıtma bir *miss*. Tavan bu yüzden 12: kalan
  18 kullanıcının kendi açtıklarına. Kendi okumasını reddettiren bir ön yükleme,
  düzeltmeye çalıştığı şeyi bozar.
- **Bütçenin günü UTC olmak zorunda.** Sunucunun penceresi epoch hizalı UTC;
  cihazın yerel günü kullanılsaydı +03:00'ta gece yarısı istemci bütçesi
  sunucudan üç saat önce sıfırlanır ve o üç saatteki istekler 429 yerdi.
- **`ContentNotice` her sebebe "bağlantını kontrol et" diyordu.** Yapılandırması
  olmadan çıkmış bir sürüm derlemesinde bu, kullanıcıyı düzeltemeyeceği bir yere
  yollamak ve gerçek sebebi gizlemek — üstelik `env.problem` hangi değişkenin
  eksik olduğunu adıyla taşıyor ve ekrana hiç ulaşmıyordu. Daha kötüsü: README
  aylardır *"ekranda hangi değişkenin eksik olduğunu söyler"* diye yazıyordu.
  **Davranışı anlatan bir belge, davranış değildir** — bu defterde aynı madde
  bir yorum için zaten var, bu sefer README'de oldu. `unconfigured` artık kendi
  hata kodu ve şerit sebebi yazıyor; yeniden deneme düğmesi de çizilmiyor,
  çünkü aynı paket her denemede aynı cevabı verir.
- **Bir ekranın bir hook'u çağırdığını hiçbir birim testi göremez.** Isıtma
  hook'unun kendi testleri, `FeedView`'daki çağrı silinse yeşil kalır — ve
  silindiğinde görünen tek şey haberlerin yine yavaş açılması olur, ki bunu
  kimse hata diye bildirmez. `check:release` çağrının yerinde durduğunu
  doğruluyor; üç kırılmanın üçünde de kırmızı verdiği görüldü.
- **`gcTime: 0` bir önbellek testini kendi kurulumuyla kırar.** Gözlemcisi
  olmayan bir `setQueryData` girdisi anında toplanıyor, yani "önbelleğe yazdı
  mı" iddiası her zaman `undefined` görüyor. Sızıntı korkusuyla sıfırlamak
  yerine sonlu bir değer verip `afterEach`'te `client.clear()` demek gerekiyor.

### "Yayına girmeden hazırlansın" — sunucu değiştirilemiyorken

- **Backend deposu emekliye ayrıldı, dağıtılmış fonksiyonlar çalışmaya devam
  ediyor.** Doğru düzeltme (`sync-feeds` yeni haberi eklerken özet işini de
  kuyruğa koysun) oraya yazılamıyor. Uygulamanın elindeki tek kaldıraç **ne
  göstereceği**, o yüzden "yayın" burada akışa girmek olarak tanımlandı: özeti
  olmayan taze haber listeye hiç girmiyor, arka planda ısıtılıyor, hazır olunca
  geliyor. Kaldıracın olmadığı yerde tanımı değiştirmek, sorunu görmezden
  gelmekten iyidir — ama bunun bir tanım değişikliği olduğu yazılmalı.
- **İçerik saklayan her kuralın bir tavanı olmak zorunda.** Gövdesi olmayan bir
  haberin özeti hiç üretilemiyor (`unavailable`), yani `summary_ready` sonsuza
  kadar false. Tavansız bir kapı o haberi ebediyen saklardı — ve bunu kimse
  bildirmez, çünkü **görünmeyen bir haberin eksik olduğu belli olmaz.** Kapı bu
  yüzden yaşa bağlı: 30 dakika (çekim 15 dakikada bir + worker 2 dakikada bir =
  en kötü ~17 dakika; tavan onun iki katına yakın).
- **Bozuk bir tarihte içerik saklanmıyor.** `publishedAt` okunamıyorsa haber
  gösteriliyor: iki hatadan biri geç gelen bir özet, öteki hiç görünmeyen bir
  haber.
- **Bekleyen haber ekranda söyleniyor.** Sessizce saklamak, kullanıcının
  yenileyip "değişmedi" görmesi demek — ve akış boşken "Bu filtrede haber yok"
  yazmak düpedüz yanlış olurdu; o durumda "HAZIRLANIYOR" yazıyor.
- **Kapı ile ısıtma bir çift, ve tek başlarına ikisi de zararlı.** Kapısız
  ısıtma yarım hazırlanmış haberi akışa sokar; ısıtmasız kapı haberleri pencere
  dolana kadar saklar. `check:release` ikisinin de yerinde durduğunu ayrı ayrı
  doğruluyor.
- **`EXPO_PUBLIC_*` bir EAS değişkeninde `secret` olamaz, `plain text`
  olmalı.** Değer zaten derleme anında JS paketine gömülüyor; `.ipa`'yı açan
  herkes okuyabiliyor. `secret` görünürlük hiçbir şey saklamıyor — yalnızca
  `eas env:list` ile geri okumayı engelleyip doğrulamayı imkânsız yapıyor.
  Supabase anon anahtarı da tasarımı gereği açık; koruma RLS'te.
- **`eas env:create` `.env` okumuyor.** Değeri yalnızca `--value`'dan alıyor,
  hangi klasörde çalıştırıldığının değere etkisi yok. Dosyadan yükleyen komut
  ayrı: `eas env:push <ortam> --path .env`. (`env:create` artık deprecated,
  yerine `eas env:set`.)

### Bildirim otomasyonu — kime, neye göre, ve neyin gitmemesi gerektiği

- **`devices` yazılmıyorsa push diye bir şey yok.** Token bir `useRef`'te
  duruyordu ve onu okuyan efektin bağımlılığı değildi: `hydrated` true olunca
  efekt koşuyor, token o an `null`, ve token gelince ref yazılıyor ama render
  tetiklenmediği için efekt bir daha koşmuyor. Sonuç, cihaz kaydının yalnızca
  kullanıcı bir ayarı değiştirdiğinde yazılması. Bir promise'in çözümünü ref'e
  yazıp o ref'i bir efektin okumasını beklemek, React'te her zaman bu hata.
- **Otomasyonda asıl iş "ne gönderilmeyecek".** Gelmeyen bildirim can sıkar;
  gelmemesi gereken bildirim güveni bozar ve geri alınamaz. `src/pushPolicy.ts`
  bu yüzden saf ve her dalı testli: düzenlemede gönderme (bir yazım hatası
  düzeltmesi herkese ikinci "yeni atölye" atmasın), geçmiş tarihli etkinliği
  duyurma, **hiç duyurulmamış etkinliğin iptalini duyurma** (kullanıcının hiç
  duymadığı bir şeyin iptal edildiğini söylemek), boş kazanan listesini
  duyurma (o "sonucu geri al" demek).
- **Önce kilit, sonra gönderim.** `pushLog/{kind}__{eventId}` dokümanı
  `create()` ile yazılıyor — var olan kimlikte fırlıyor, yani iki eşzamanlı
  istek de aynı bildirimi gönderemiyor. Sıra ters olsaydı yarıda kalan bir
  istek yeniden denendiğinde herkese ikinci kez giderdi.
- **Sessiz saatler atlama değil erteleme.** Eski `send-push` sessiz saatlerdeki
  cihazı listeden düşürüyordu: gece açılan bir atölyeyi o kullanıcılar hiç
  duymuyordu ve düzeltmesi "sabah komutu tekrar çalıştır"dı — yani otomasyonun
  olmadığı yer. Şimdi `pendingPushes`'a giriyor ve panel 08:00'de gönderiyor.
- **Kuyruktan çıkan bildirim yeniden doğrulanıyor.** Aradan gece geçiyor:
  etkinlik silinmiş olabilir (o zaman bildirim düşürülüyor — sabah "yeni
  atölye" deyip kullanıcıyı silinmiş bir kayda göndermek en kötüsü) ve
  kullanıcı gece bildirimleri kapatmış olabilir.
- **Sessiz saat penceresi kulüp saatinde hesaplanıyor.** Panel bir konteynerde
  koşuyor ve dilimi genellikle UTC; `new Date().getHours()` ile hesaplanan
  pencere üç saat kaymış olurdu — 23:00 UTC, Kocaeli'de 02:00. `clubHour`
  `todayLocal` ve `clubCalendar`'ın yanında duruyor.
- **Otomatik gönderim varsayılan olarak AÇIK, ve panel açılışta hangi modda
  olduğunu yazıyor.** Kapalı varsayılan, bu defterdeki iki maddenin aynısı
  olurdu: sessizce çalışmayan bir özellik. Yerelde çalışırken gerçek
  kullanıcılara gitmesini engellemek için `ADMIN_AUTO_PUSH=off`.
- **Bir yerel zamanlayıcı içeriği bilemez.** Bülten bildirimi "Bugünün beş
  başlığı hazır." diyordu; kurulduğu an ile çaldığı an arasında bir gün var ve
  o gün bülten üretilmemiş olabilir. İçeriğe göre konuşan bildirim ancak
  sunucudan gelen bir push olabilir — zamanlayıcıyla söylenebilecek doğru şey
  bir hatırlatma.
- **Ayar ekranındaki açıklama bir vaattir.** "Kontenjan güncellendiğinde" ve
  "başvuru dönemleri" yazıyordu; ikisini de tetikleyen hiçbir şey yoktu.
  Açıklamalar artık kodun yaptığını anlatıyor, ve yeni bir kategori
  açıklamasının karşılığı yoksa önce mekanizma yazılmalı.
- **Duyuru otomasyonunun ilk turu sessiz olmak zorunda.** Duyurular panelde
  değil kulübün sitesinde yazılıyor, yani panel onları yoklayarak öğreniyor.
  Defter boşken sitedeki her duyuru "yeni" görünür: otomasyon devreye girdiği
  gün herkesin telefonu arka arkaya on kez titrerdi. İlk tur yalnızca mevcut
  listeyi işaretliyor (`pushState/announcements.seededAt`), bildirim bir
  sonraki gerçekten yeni duyuruyla başlıyor. Yaş sınırı (24 saat) ikinci
  koruma: panel bir süre kapalı kalıp geri döndüğünde birikmiş listeyi görüyor.
- **Okunamayan tarihte hangi tarafa düşüleceği içeriğe göre değişir.** Akış
  kapısında bozuk `publishedAt` haberi **gösteriyor** (içerik saklamamak için);
  duyuru bildiriminde bozuk `createdAt` **göndermiyor**. Risk ters yönde: orada
  saklanan bir haber, burada herkese giden bir bildirim.
- **Bir guard'ın aradığı dize yalnızca korumak istediği yerde geçmeli.** Duyuru
  dokunma dalını doğrulayan kontrol `announcementId` arıyordu; o ad tip
  anotasyonunda da geçiyor, dolayısıyla dal silindiğinde kontrol yeşil kaldı —
  ölçüldü. Artık rotayı (`/duyuru/`) arıyor. Alan adı değil, davranışın izi.
- **Kilit gönderimden önce alınıyorsa, başarısız gönderimde geri verilmeli.**
  Yinelenen bildirim eksik bildirimden çok daha fazla zarar verdiği için sıra
  doğru; ama gönderim patladığında `catch` hatayı yutuyor ve kilit kalıyordu —
  o olay bir daha asla duyurulamaz, ve kimse fark etmez. Kimseye ulaşmamış bir
  gönderimin kilidi siliniyor: gönderilmemiş bir şeyin ikinci denemesi
  yinelenen bildirim üretemez. Yan etkisi de doğru yöne bakıyor —
  `alreadyAnnounced` artık "denendi mi" değil "duyuruldu mu" diyor, ki iptal
  bildiriminin dayandığı şey tam olarak bu.
- **Zincirin her halkası sessizce koptuğunda teşhis bir özelliktir.** Cihaz
  kaydı yazılmamış olabilir, panel eski kodu çalıştırıyor olabilir, gönderim
  kimseye ulaşmamış olabilir — üçünün de tek belirtisi "bildirim gelmedi"ydi ve
  üçü de sunucu günlüğünde yazıyordu, ki operatör ona bakmıyor. Panelin
  `/bildirimler` sayfası bunu ekrana taşıyor. Aynı soruyu üç kez yaşadıktan
  sonra eklendi.
- **`tsx` üst düzey `await`'i CJS'e çeviremiyor** (`ERR_REQUIRE_ASYNC_MODULE`).
  `check:panel`'e asenkron bir kontrol eklerken IIFE gerekiyor — ve çıkış
  satırları da o bloğun içine taşınmalı, yoksa iddialar sayılmadan
  `process.exit` koşar ve kontrol her zaman yeşil verir.
- **`autoIncrement: true` sürümü değil build numarasını artırıyor.** Kurulu
  `@expo/eas-json` şeması net: profil kökünde alan yalnızca `boolean`, ama
  `ios` altında `'version' | 'buildNumber'`, `android` altında
  `'version' | 'versionCode'` da kabul ediliyor. Yani `production`'daki
  `autoIncrement: true` her derlemede `buildNumber`/`versionCode` artırıyor ve
  kullanıcıya görünen `version` **hiç değişmiyor** — mağazada yayımlanmış bir
  sürümün üzerine yeni sürüm çıkarırken `app.json` elle güncellenmek zorunda.
  "Otomatik artıyor" diye bırakmak, App Store'un aynı sürüm numarasını ikinci
  kez kabul etmemesiyle sonuçlanıyor.
- **Sürüm otomatiğe bağlanmadı, ve bu bir karar.** `ios.autoIncrement:
  "version"` mümkün ama aynı sürümün beş TestFlight derlemesi 1.1.5 üretirdi;
  üstelik `appVersionSource: "remote"` ile sayı EAS'a taşındığı için depoya
  bakan biri hangi sürümün canlıda olduğunu göremezdi. Sürüm bir ürün kararı,
  sayaç değil.

### "Çeviri geç geliyor / hiç gelmiyor" raporundan — sunucunun dört tavanı

Cihazdan gelen soru şuydu: *"API key rate limitine mi takılıyor? İki tane var,
farklı kaynaklardan, takılmaması gerek."* Cevap hayır, ve neden hayır olduğu
`Akadirr1/follow-ai` kaynağında yazıyor. **Sunucu sözleşmesini tahmin etmeyin,
kaynağı okuyun** — bu defterde zaten bir kez `summary_tr`/`bullets` olarak
yaşandı.

- **İki sağlayıcı anahtarı yalnızca `retryable` hatada işe yarıyor.**
  `_shared/ai-provider.ts` `withFallback`: primary başarısız olursa ikinci
  sağlayıcı **sadece** hata retryable ise deneniyor. 429 tam da bunun için
  (yorumu açıkça söylüyor). Ama `refusal`, `auth`, `bad_request` ve **her
  `schema_*`** non-retryable — ikinci anahtar hiç görülmüyor. Yani "iki key var"
  varsayımı yarı doğru, ve yanlış olan yarısı asıl başarısızlık sınıfını kapsıyor.
- **Asıl darboğaz sağlayıcı limiti değil, sunucunun kendi tavanları.** Dördü
  birden: cron `*/2 * * * *` × `max_jobs: 3` = **saatte 90 makale** (global,
  tüm kullanıcılar); `AI_DAILY_CAP_DEFAULT = 200`/gün (dolunca worker
  `skipped:'daily_cap'` deyip hiçbir şey işlemiyor); şema ihlalinde kalıcı ölüm;
  çıktı iki kez kesilirse (`truncatedTwice`) iş ölü. İki API anahtarı bunların
  hiçbirine dokunmuyor.
- **Çeviri ve özet tek çağrı, tek şema — biri giderse ikisi de gidiyor.**
  `_shared/schemas.ts`: makale dili `tr` değilse model çeviriyi vermek
  **zorunda**, vermezse `translation_missing_for_foreign_article`. Dil de
  tespit edilmiyor, kaynaktan miras alınıyor (`_shared/ingest.ts`).
- **Ölü bir iş istemciye hâlâ `queued` görünüyor.** `_shared/enrichment.ts`:
  denemeleri tükenmiş işin cevabı yine `queued`, sebep `previous_attempt_failed`.
  Yani "hazırlanıyor" ile "bir daha asla" kablodan aynı `status` ile geçiyor;
  ayıran tek şey `reason`.
- **Haberlerin kısa olması hata değil, besleme.** `_shared/feed.ts`: tam metin
  çekimi yok. `content:encoded` varsa tam gövde, yoksa `<description>` yani
  teaser — ve kodun kendi yorumu "altı beslemeden yalnızca Webrazzi
  `content:encoded` gönderiyor" diyor. Haberin taze olması uzunluğunu
  değiştirmiyor; uzunluğu yayıncı belirliyor.

Uygulamanın kaldıracı yine yalnızca **ne göstereceği**: teşhis zaten
`console.warn`'a yazılıyordu ve bir release derlemesinin konsolu yok, yani
kullanıcıya ulaşan tek şey sonsuza kadar dönen bir göstergeydi. Artık gösterge
yalnızca gerçekten bir istek uçuştayken dönüyor, ve durduğunda sunucunun
`reason`'ı ekrana yazılıyor (`enrichmentStalledMessage`).

### React Query'nin izlenen özellikleri — iki ölçüm

İkisi de yukarıdaki düzeltmeyi yazarken çıktı ve ikisi de sessizce yanlış
davranıyordu.

- **`dataUpdateCount` `QueryState`'te duruyor, `useQuery`'nin döndürdüğü nesnede
  değil** (kurulu `@tanstack/query-core` tiplerinde ölçüldü: `QueryState`'te var,
  `QueryObserverBaseResult`'ta yok). Client'tan okunabiliyor ama **izlenen bir
  özellik olmadığı için değiştiğinde render tetiklemiyor** — ondan türetilen bir
  bayrak hiçbir zaman dönmüyor. Yoklama sayacına dayanan "yoklama bitti mi"
  bayrağı tam olarak böyle çalışmadı.
- **Sonucu yaymak (`{...query}`) her alana abone olmaktır.** İzlenen özellikler
  hangi alanı okursanız ona abone ediyor; yaymak bütün getter'ları okuyor,
  dolayısıyla optimizasyonu kapatıp fazladan render üretiyor. Görünür sonucu:
  yoklama bitiminde bir kez yazılması gereken uyarı iki kez yazıldı ve mevcut
  "warns once" testi kırmızı verdi. `Object.assign(query, …)` hedefi okumadığı
  için aboneliği bozmuyor — ama yukarıdaki madde yüzünden o da çözüm değildi.

Sonuçta sayaç hiç kullanılmadı: "iş öldü" bilgisi zaten sunucudan ilk cevapta
`previous_attempt_failed` olarak geliyor, ve "şu an gerçekten deniyor muyuz"
sorusunun cevabı `isFetching`. **Türetilecek bir durum ararken önce elde olanı
sayın** — sayaç, olmayan bir soruna yazılmış bir mekanizmaydı.
