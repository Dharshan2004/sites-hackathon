# One Minute Museum

Turn any photograph into a miniature, interactive museum you can visit, hear, and share.

**Live exhibition:** [minutes-museum.dharshanlab.chatgpt.site](https://minutes-museum.dharshanlab.chatgpt.site)

One Minute Museum is a creative consumer experience built for the ChatGPT Sites Hackathon. A visitor uploads one photograph, chooses an architectural world, and receives:

- a high-quality isometric museum render anchored to the original moment
- three AI-written exhibits that are visually mapped onto the finished room
- an adaptive WebGL presentation with image relief, camera focus, lighting, and particles
- a narrated guided tour and visitor catalogue
- an unlisted museum link
- a downloadable 1080 × 1920 Story card with a QR code back to the room

## Why it is more than one prompt

The product is a recoverable, staged pipeline:

1. The browser validates, orients, resizes, and compresses the photograph before upload.
2. The server secures an idempotent museum job in D1 and stores the short-lived source in R2.
3. OpenAI image generation creates a specific architectural exhibition around the supplied photograph.
4. The source upload is removed after the render handoff.
5. A second OpenAI vision pass inspects the finished render, writes accessible exhibit metadata, and maps three real visual details.
6. The browser presents the result through Three.js on capable devices, with a static fallback for mobile, reduced-motion, and low-power visitors.
7. Ordinary 2D canvas composes the portable Story card because social platforms cannot preserve WebGL.

The client persists the active job locally, polls recoverable phases, honors server retry hints, and can resume after a refresh or interrupted connection. Public creation uses atomic global and privacy-preserving per-visitor rate buckets.

## Architectural worlds

Gothic, Art Deco, Art Nouveau, Brutalism, Bauhaus, Moorish, Ancient Egyptian, and Neo-futurist Solarpunk. Each choice has its own visual motif, material direction, blueprint animation, and generation prompt.

## Two-minute demo

1. Open the finished example to show the experience immediately.
2. Move the pointer over the room, then choose an exhibit marker to show the camera and light reacting.
3. Start the guided tour and point out the live visitor catalogue.
4. Print the selected exhibit as a Story card, then show its QR code.
5. Return home, upload a photograph, choose or roulette an architectural world, and start a real generation.
6. Explain that the first response secures the job before OpenAI work begins, so a refresh does not lose it.

## Local setup

1. Use Node.js 22.13 or newer.
2. Run `npm install`.
3. Create `.env.local` and add `OPENAI_API_KEY`.
4. Run `npm run dev`.

The deployed Site provides D1 as `DB`, R2 as `FILES`, and the OpenAI key as a server-only secret. Never expose the key to client code.
The app uses ChatGPT Sites D1 (`DB`) for resumable museum metadata and R2 (`FILES`) for generated rooms. A second multimodal pass reads the finished render, writes grounded labels, and returns validated hotspot coordinates. Three.js adds a subtle 2.5D parallax presentation on capable desktop devices; touch, low-power, and reduced-motion visitors receive the static render.

## Working with a partner

Create separate branches from `main`, push them to GitHub, and merge through pull requests. Do not commit `.env.local` or API keys. A useful split is for one person to own the generation and persistence pipeline while the other owns the exhibition interaction, card export, and demo polish.

## Deliberate boundaries

- This is a 2.5D presentation of an AI-generated room, not automatic 3D reconstruction.
- The original upload is available for an in-session comparison on the creator's device, but is not exposed from the shared link.
- Shared museums are unlisted bearer links, not account-private galleries.
- Instagram receives a downloaded or natively shared image; direct posting would require a separate Meta authentication flow.
