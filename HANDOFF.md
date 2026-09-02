# One Minute Museum — Review and Experience Handoff

> **Review snapshot:** `origin/main` at `50a87fc6e79679bc55569c34ff64ae19f8240778` on 2026-09-02<br>
> **Repository:** <https://github.com/Dharshan2004/sites-hackathon><br>
> **Purpose:** Combine the current-state review with the proposed experience during the long AI render.

## Decision in one sentence

Keep **One Minute Museum** and make the complete journey feel like a museum opening:

> **Architectural roulette → historical world-building while AI renders → opening-night reveal → grounded exhibit tour → collectible social postcard.**

The roulette must not feel like a filter picker. It selects one coherent architectural world that controls the visuals, educational content, generation prompt, reveal, museum identity, and postcard.

## Scope and authorization

This commit adds documentation only. It does not authorize product-code changes, deployment, database migration, secret changes, or external-service changes. Implementation should begin only after Raf and Dharshan agree on the shared state model and divide the work through the repository's branch-and-PR workflow.

## Product thesis

**One Minute Museum gives an ordinary photograph an architectural afterlife.**

The user arrives with a photo, enters a randomly selected visual and historical world, watches that world construct itself while the AI works, explores three details from the resulting museum, and leaves with a social artifact.

> Upload a memory. Enter an architectural world. Leave with a museum.

## Current implementation

The latest reviewed `main` already contains:

- Photo upload and in-browser WebP resizing before transmission.
- Eight architectural worlds:
  - Gothic — **Cathedral of Shadows**
  - Art Deco — **Golden Metropolis**
  - Art Nouveau — **Garden of Lines**
  - Brutalism — **Concrete Giant**
  - Bauhaus — **Primary Playground**
  - Moorish — **Infinite Palace**
  - Ancient Egyptian — **Temple of the Sun**
  - Neo-futurist solarpunk — **Tomorrow Is Growing**
- Manual world selection and a random **Surprise me** action.
- A background OpenAI Responses workflow for the long-running render and curation jobs.
- Client polling with changing status copy while the jobs run.
- D1 metadata and job-state persistence plus R2 source/render storage.
- A generated landscape museum image with three exhibit descriptions and hotspot coordinates.
- An exhibition view with subtle Three.js parallax on capable desktops and a static fallback elsewhere.
- An unlisted museum URL, native URL sharing or clipboard fallback, and a downloadable 1080×1920 PNG Story card.
- Site-wide and museum-specific metadata foundations.

### What the newest background change improves

Commit `50a87fc` moves the expensive operations out of the initial request. The initial endpoint starts two background Responses, stores their IDs, returns a processing job, and lets the browser poll a status endpoint. This is directionally aligned with official OpenAI background-mode guidance and creates the space needed for the proposed two-minute experience.

### Verification performed for this handoff

- The latest reviewed snapshot completed `npm run build` successfully from a clean temporary copy.
- Focused linting passed for `app`, `lib`, `db`, and the three product-specific museum components.
- Repository-wide lint still reports errors in unused generated UI components and `hooks/use-mobile.ts`.
- A production dependency audit reported five high-severity advisories. This count does not prove that every advisory is reachable in the deployed app; each should be assessed and patched where compatible.
- No browser interaction, live OpenAI generation, deployed D1/R2 run, social-unfurl test, or mobile export test was performed as part of this review.

## Review findings and recommended steering

### P0 — Protect the core promise

#### 1. Exhibit hotspots and the final museum do not share a coordinate system

The background render and curation both analyse the original photo in parallel. The image job then rearranges that photo into a new museum composition, but the original-photo coordinates are placed over the generated museum.

This is a verified architectural mismatch. Its visible severity still needs sample testing.

**Steer:** after the final museum image exists, run the curator against that final image and generate the three labels and normalized coordinates from it. Until that is reliable, show grounded exhibit cards without spatial markers rather than presenting inaccurate hotspots.

#### 2. The paid generation route is publicly callable

Every accepted request can start an expensive high-quality image-generation job plus a curation job. There is no application-level authentication, human challenge, per-user quota, concurrency cap, or rate limiter in the reviewed code.

**Steer before broad public sharing:**

- Set a project spending ceiling and alerts.
- Add request throttling and a concurrency guard.
- Strictly validate allowed image formats and architectural-world IDs on the server.
- Keep a pre-generated demo path that does not consume an API call.

#### 3. The new background job needs complete terminal-state handling

Official OpenAI guidance says to keep polling only while a background Response is `queued` or `in_progress`; once it leaves those states, it is terminal. The current status route explicitly handles `completed`, `failed`, and `cancelled`, but another terminal state could be treated as if it were still processing.

**Steer:** model the allowed job states explicitly. Continue only for `queued` and `in_progress`; accept `completed`; convert every other terminal status into a stable failed state with recoverable user copy.

#### 4. Job finalization currently depends on an open browser

The status endpoint retrieves the completed outputs, stores the render, and changes the museum to `ready`. If the user closes the tab before polling completes, the job can remain in `processing` and the stored source can become orphaned.

There are two related failure paths:

- The render and curation jobs are started together before their database record is safely persisted. If one startup or a later storage step fails, a paid job may continue without a recoverable local record.
- The status endpoint collapses transient retrieval, parsing, R2, and D1 errors into an HTTP 502. The browser treats non-network HTTP errors as terminal immediately, so its multi-failure reconnect logic does not cover these temporary server failures.

**Steer:** persist a recoverable job record first, save each response ID independently, and compensate or cancel when partial startup fails. Add server-side completion or cleanup; a webhook/queue is the durable option and a time-bounded stale-job cleanup is the minimum. Persist the job ID in the URL or local session so refresh can resume. Retry bounded `429`/`5xx` status checks with backoff, and reserve permanent UI failure for a stored terminal state. Make finalization idempotent so simultaneous polls cannot corrupt state.

#### 5. Apply the new D1 migration before exercising the new job flow

The latest code adds `status`, response-ID, and error columns. `CREATE TABLE IF NOT EXISTS` does not add columns to an existing table.

Two read routes also retain the legacy table definition. If either bootstraps a new empty database before the POST route runs, it can create a table without the columns required by the background workflow.

**Steer:** inspect and apply the checked-in migration through the normal Sites deployment workflow before testing the background flow against an existing D1 database. Remove runtime schema bootstrapping from request paths once migrations own the schema, or ensure every bootstrap definition is generated from one canonical schema.

### P1 — Make the waiting experience the signature feature

#### 6. “Surprise me” is random selection, not yet a roulette ceremony

The current action immediately changes the selected value. There is no acceleration, cycling, lock-in, winning-world title card, or theme transformation.

**Steer:** create a 1.5–2.5 second deterministic animation that visibly races through the eight worlds, slows, and locks. The selected `worldId` must be decided once and persisted before the render request begins.

#### 7. Current progress copy is useful but generic

The new implementation reports messages such as “Constructing your architectural world” and “The curator is writing your exhibit labels.” This is better than an indefinite spinner, but it does not yet immerse the visitor in the selected world.

**Steer:** use four honest chapters instead of percentages:

1. **The Selection** — roulette and world lock-in.
2. **The Blueprint** — verified history and style-specific construction animation while the image job runs.
3. **The Curation** — analyse the finished museum and place grounded exhibits.
4. **Opening Night** — complete the current animation beat, then reveal the finished museum.

If the render is ready early, finish the current short beat and reveal it. If it runs long, loop the themed ambient construction without claiming false progress.

The present client polls every 2.5 seconds and retrieves both OpenAI responses on every check. Once correctness is stable, add gentle backoff and avoid repeatedly retrieving a half that is already known to be complete.

#### 8. Mobile should be the primary social path

The concept begins with personal photographs and ends with social sharing, but the current picker has no explicit camera action and the Three.js treatment is intentionally disabled on compact screens.

**Steer:** provide clear **Take a photo** and **Choose a photo** actions. Use lightweight CSS/canvas movement for the mobile blueprint and reveal. Preserve captions and a deliberate reduced-motion transition.

### P1 — Complete the social payoff

#### 9. “Share” currently shares a URL, not the postcard

The PNG card and URL sharing are separate operations.

**Steer:** render the postcard to a `Blob`, create a `File`, and use native file sharing when `navigator.canShare({ files })` permits it. Retain PNG download and copy-link fallbacks.

#### 10. The current Story composition can crop the museum heavily

The museum render is landscape (`1536×1024`) while the Story card is portrait (`1080×1920`). The current cover-style placement can remove substantial material from both sides.

**Steer:** design a real portrait composition that contains the full museum image inside an intentional frame, then uses the remaining space for the world name, museum title, edition, one exhibit quote, and deep link.

#### 11. Shared-page previews need live verification

Museum-specific social imagery depends on `NEXT_PUBLIC_SITE_URL`, but the current README documents only `OPENAI_API_KEY`.

**Steer:** document the trusted site origin, configure it in hosting, and verify one real shared museum in common social debuggers or messaging previews.

### P1 — Earn trust with personal photographs

#### 12. The source photograph and final render have no visible retention lifecycle

Successful jobs persist the optimized source, the generated museum, and metadata. There is no delete action or expiry in the reviewed flow. The interface promises an unlisted link but does not explain retention.

The new background implementation also explicitly sets `store: true`. Official OpenAI documentation says stored Responses application state is retained for at least 30 days. Background requests can instead use temporary storage for polling when `store` is omitted or set to `false`, subject to the product's required retrieval window.

**Steer:**

- Remove explicit long-term OpenAI response storage unless it is required.
- Delete the original R2 object after the final museum is safely persisted if no feature needs it.
- Agree on and state a museum retention period.
- Add deletion and stale-job cleanup.
- Keep the page language precise: local optimization is private, but the image is then uploaded for AI processing.

Official references:

- [OpenAI background mode](https://developers.openai.com/api/docs/guides/background)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)

### P2 — Remove collaboration friction

#### 13. The local setup instructions reference a missing file

The README tells a partner to copy `.env.example`, but that file is absent and the current ignore rule covers `.env*`.

**Steer:** commit a placeholder-only `.env.example` through an explicit ignore exception. It must contain names and safe explanatory placeholders only—never a real key.

#### 14. Keep one guaranteed demonstration path

Live image generation, venue Wi-Fi, quotas, and mobile browser behaviour can all fail independently.

**Steer:** add **Try an example** with a pre-generated museum that exercises the complete reveal, tour, and postcard flow without starting an API request.

## Target experience

```text
Upload photograph
        ↓
THE SELECTION — theatrical architectural roulette
        ↓
Winning-world title card
        ↓
THE BLUEPRINT — verified micro-history + themed construction
        ↓
THE CURATION — final-render analysis and exhibit preparation
        ↓
OPENING NIGHT — curtain/door/blueprint-to-museum reveal
        ↓
Accurate three-exhibit guided tour
        ↓
Collectible social postcard
```

### Chapter 1 — The Selection

- Keep the uploaded photograph visible as the seed of the museum.
- Spin through all eight architectural names and visual motifs.
- Slow down and lock onto one result.
- Shift the interface palette, typography, geometry, ambience, and optional sound to the selected world.
- Show a decisive title card, for example:

> **GOLDEN METROPOLIS**<br>
> ART DECO

Manual selection may remain as an alternate path, but the roulette should be the primary demo experience.

### Chapter 2 — The Blueprint

While the background image job runs:

- Introduce the style with a concise, verified historical micro-story.
- Reveal two or three signature visual features.
- Introduce one verified landmark.
- Build a theme-specific blueprint around the uploaded photograph.
- Offer **Hear the curator** only after a user gesture.
- Keep every spoken line available as a permanent caption.

The fact bank must be local and immediate. OpenAI may turn approved facts into concise theatrical narration, but it must not freely invent architectural history. If personalized narration is late or fails, show the approved captions without delaying the museum.

### Chapter 3 — The Curation

Once the final museum image exists:

1. Store the render safely.
2. Analyse that final render—not the original source—for three visible exhibit subjects.
3. Return concise grounded labels and normalized coordinates.
4. Validate text length and clamp coordinates before display.
5. Fall back to non-spatial exhibit cards if analysis fails.

The blueprint animation continues while this pass completes.

### Chapter 4 — Opening Night

- Finish the current animation beat rather than cutting abruptly.
- Let blueprint geometry resolve into the generated architecture.
- Open doors, part curtains, or dissolve drafting paper into the museum.
- Introduce exhibit markers only after their final coordinates exist.
- Pulse the first exhibit gently so the next action is obvious.
- Let visitors follow a short guided sequence or explore freely.

### Final artifact — The social postcard

The final composition should contain:

- The complete museum render.
- Museum title.
- Architectural style and world name.
- Edition or collection number.
- One short exhibit quotation.
- One-line invitation and museum deep link or QR code.
- One Minute Museum signature.

Output priority:

1. Legible 9:16 PNG.
2. Native image-file sharing where supported.
3. PNG download and URL-copy fallbacks.
4. 4:5 feed card if time permits.
5. Animated video only after the core path is stable.

## One architectural registry

Use one typed, source-controlled registry as the authority for all eight worlds.

```ts
type ArchitecturalWorldId =
  | 'gothic'
  | 'art-deco'
  | 'art-nouveau'
  | 'brutalism'
  | 'bauhaus'
  | 'moorish'
  | 'ancient-egyptian'
  | 'solarpunk';

type ArchitecturalWorld = {
  id: ArchitecturalWorldId;
  displayName: string;
  worldName: string;
  eraLabel: string;
  visual: {
    colors: string[];
    motifs: string[];
    transitionPreset: string;
  };
  history: {
    summary: string;
    facts: Array<{
      text: string;
      sourceTitle: string;
      sourceUrl: string;
    }>;
    landmark: {
      name: string;
      text: string;
      sourceTitle: string;
      sourceUrl: string;
    };
  };
  generation: {
    promptFragment: string;
    negativeConstraints: string[];
  };
  waitingExperience: {
    captions: string[];
    animationPreset: string;
    narrationTemplate: string;
  };
  postcard: {
    framePreset: string;
    typographyPreset: string;
    captionTemplate: string;
  };
};
```

The persisted `worldId` must control:

- Roulette result.
- Winning title card.
- History and landmark copy.
- Colours, typography, and motifs.
- Waiting animation and captions.
- Image-generation prompt.
- Museum header.
- Postcard treatment.
- Shared-page rendering after refresh.

This prevents the experience from feeling randomly assembled.

## Suggested creative map

Historical copy in this table is intentionally not written yet; each fact and landmark requires primary or institutional sourcing before publication.

| World | Visual vocabulary | Waiting animation | Palette direction |
|---|---|---|---|
| Cathedral of Shadows / Gothic | Arches, tracery, stained-glass light | Vertical stone lines rise; coloured light fills their openings | Midnight, plum, crimson, cold stone |
| Golden Metropolis / Art Deco | Stepped geometry, sunbursts, metallic symmetry | Gold drafting lines climb like a skyscraper elevation | Black, brass, cream, emerald |
| Garden of Lines / Art Nouveau | Botanical curves, ironwork, flowing ornament | Vines trace the photo frame and flower into structural lines | Moss, rose, amber, glass green |
| Concrete Giant / Brutalism | Monumental planes, voids, raw texture | Heavy blocks stack and cantilever around the image | Concrete, charcoal, bone, safety orange |
| Primary Playground / Bauhaus | Grids, circles, rectangles, primary accents | Geometric pieces choreograph themselves into a plan | Red, yellow, blue, white, black |
| Infinite Palace / Moorish | Tessellation, courtyards, arches, carved pattern | Tiles multiply outward and resolve into an archway | Cobalt, turquoise, terracotta, ivory |
| Temple of the Sun / Ancient Egyptian | Pylons, columns, processional symmetry, solar form | A horizon line rises; columns and a gold beam establish the axis | Sandstone, lapis, gold, black |
| Tomorrow Is Growing / Solarpunk | Sweeping curves, planted terraces, solar surfaces | White structures unfold while living forms bloom through them | White, chlorophyll, cyan, warm sunlight |

## Proposed state model

```text
idle
→ photo_ready
→ roulette_spinning
→ world_selected
→ job_starting
→ render_queued
→ rendering
→ curating_final_render
→ reveal_ready
→ revealing
→ museum_ready
→ exporting_or_sharing
```

Failure and recovery states should be explicit:

```text
upload_rejected
job_start_failed
connection_interrupted
render_failed
curation_degraded_to_cards
job_expired
export_failed
```

The client should never infer factual server progress from elapsed time. Elapsed time may select an animation beat, while actual server state determines whether the workflow advances.

## Recommended request pipeline

```text
Validate upload, architecture ID, quota, and bindings
        ↓
Persist job and selected worldId
        ↓
Start background museum render
        ↓
Return job ID immediately
        ↓
Play local fact-bank experience while polling queued/in_progress
        ↓
Receive and persist completed museum image
        ↓
Start final-render curation
        ↓
Validate and persist grounded exhibits
        ↓
Mark museum ready
        ↓
Run Opening Night reveal
```

For privacy, consider omitting `store` or using `store: false` for background Responses after confirming the temporary retrieval window safely covers the product's maximum job duration. Official documentation states that background outputs remain temporarily available for polling even without long-term storage.

## Phased implementation plan

### P0 — Demo reliability and truthfulness

- Apply and verify the background-job D1 migration.
- Handle every OpenAI terminal state correctly.
- Make job finalization idempotent and clean stale jobs.
- Protect the paid endpoint and configure spend controls.
- Curate the final render or disable spatial hotspots.
- Add one pre-generated example and fallback museum URL.
- Run the complete golden path on the deployed Site and event network.

### P1 — One unforgettable world

Build **Golden Metropolis / Art Deco** end to end first:

- Shared architectural registry.
- Animated roulette and lock-in.
- Verified fact-bank entry and landmark.
- Gold blueprint waiting animation.
- Captioned, opt-in narration.
- Opening-night reveal.
- Accurate exhibits.
- World-specific postcard.

Once this path works, generalize the presets across the other seven worlds.

### P2 — Social and mobile completion

- Portrait postcard composition without destructive crop.
- Native postcard-file sharing.
- Copy-link and download fallbacks.
- Take-photo action and mobile waiting animation.
- Museum-specific social-preview verification.
- Reduced-motion and keyboard paths.

### P3 — Expansion only if the core is stable

- Complete themed motion for all worlds.
- Add 4:5 feed export.
- Add opt-in curator audio polish.
- Consider animated video export.

Do not prioritize accounts, public galleries, true 3D navigation, multiple-photo uploads, more than eight worlds, or prompt customization during the hackathon.

## Suggested partner split

### Dharshan — generation and platform reliability

- Background generation and polling lifecycle.
- Final-render curation and coordinate correctness.
- D1 migration and R2 retention/cleanup.
- Request validation, throttling, and spending controls.
- Error diagnostics and pre-generated fallback path.
- Environment and deployment documentation.

### Raf — experience and social artifact

- Roulette choreography and world lock-in.
- Architectural registry and verified fact-bank content.
- Blueprint chapters, captions, and optional narration.
- Opening-night reveal and mobile/reduced-motion variants.
- Postcard composition and native image sharing.
- Demo script and rehearsal.

### Shared contract before parallel implementation

Agree first on:

- `ArchitecturalWorld` shape.
- Persisted `worldId`.
- Museum/job status values.
- Status endpoint response shape.
- Final exhibit schema and coordinate convention.
- Retention period and deletion behaviour.

Then work on separate branches and integrate through pull requests, as the README recommends.

## Two-minute judge demo

### 0:00–0:15 — Hook

> “Most AI products make you stare at a spinner. One Minute Museum turns the wait into the experience.”

Upload a visually clear team photograph.

### 0:15–0:35 — The Selection

Trigger the roulette and let it lock onto **Golden Metropolis — Art Deco**.

> “This is not a filter. The selected world controls the history, motion, museum architecture, and final postcard.”

### 0:35–1:05 — The Blueprint

Show the photograph surrounded by Art Deco geometry while verified facts and a landmark appear.

> “While AI builds the museum, the visitor enters the world that inspired it.”

Optionally activate **Hear the curator**.

### 1:05–1:25 — Opening Night

Reveal the generated museum through the architectural transition.

> “The original memory has become an explorable museum.”

### 1:25–1:45 — Exhibits

Open two grounded exhibit markers and show that they correspond to visible details in the finished museum.

### 1:45–2:00 — Social payoff

Assemble and share or download the 9:16 postcard.

> “You arrive with one photograph and leave with a museum from another world.”

Keep the pre-generated example one click away throughout the demonstration.

## Definition of done

The hackathon MVP is ready when:

- One uploaded photo reliably becomes a museum on the deployed Site.
- The roulette visibly selects and persists exactly one world.
- The same world controls history, visuals, prompt, reveal, museum label, and postcard.
- Historical statements come only from an approved, cited fact bank.
- Rendering uses honest chapters without fake percentages.
- Every hotspot points to a visible detail in the final render, or spatial markers are disabled.
- The result survives refresh and its unlisted link opens correctly.
- The visitor can download or natively share a legible 9:16 postcard.
- Captions, keyboard use, mobile layout, and reduced motion work.
- Original uploads and stale jobs follow the agreed retention/deletion policy.
- Public generation has basic validation, throttling, concurrency, and spend protection.
- A pre-generated path completes the full experience without live AI.
- The two-minute demonstration has been rehearsed on the intended device and network.

## Immediate team decision

Do not add another feature or architectural style yet. Agree on the shared registry and job state machine, then build one complete **Golden Metropolis** path from roulette through postcard. That slice will test the product's real value and provide a reusable pattern for the remaining seven worlds.
