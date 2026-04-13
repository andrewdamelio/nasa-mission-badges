<img width="1408" height="754" alt="image" src="https://github.com/user-attachments/assets/46c441ba-252e-459c-ae4a-93ce2bedc35c" />

# NASA Mission Badge Archive

A cinematic gallery website for NASA mission patches, built with Vite and plain JavaScript.

Included now:
- 182 recovered mission patches
- Mercury, Gemini, Apollo, Skylab, Space Shuttle, Commercial Crew, and Artemis missions
- filter/search/sort controls
- immersive viewing mode
- Wikimedia + Wikipedia sourced metadata generator

## Run locally

```bash
npm install
npm run dev
```

## Rebuild the dataset

```bash
node scripts/generate-missions.mjs
```

The generator batches requests against Wikipedia and Wikimedia APIs, then writes the archive to `src/data/missions.js`.
