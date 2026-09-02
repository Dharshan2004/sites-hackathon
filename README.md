# One Minute Museum

Turn any photograph into a miniature, interactive museum: choose from eight architectural worlds, explore three vision-mapped exhibits, invite visitors with an unlisted link, and export a 1080×1920 Story card with a QR doorway back inside.

## Local setup

1. Use Node.js 22.13 or newer.
2. Run `npm install`.
3. Create `.env.local` and add `OPENAI_API_KEY`.
4. Run `npm run dev`.

The app uses ChatGPT Sites D1 (`DB`) for resumable museum metadata and R2 (`FILES`) for generated rooms. A second multimodal pass reads the finished render, writes grounded labels, and returns validated hotspot coordinates. Three.js adds a subtle 2.5D parallax presentation on capable desktop devices; touch, low-power, and reduced-motion visitors receive the static render.

## Working with a partner

Create separate branches from `main`, push them to GitHub, and merge through pull requests. Avoid committing `.env.local` or API keys. A useful split is: one person owns the generation/API pipeline while the other owns the museum interaction, card export, and demo polish.
