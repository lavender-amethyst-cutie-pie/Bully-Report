# Bully Report

After each save point, push it to GitHub.

OpenAI model: 5.6 Luna

## How to run locally

1. Keep the local `.env` file in this folder. It is ignored by Git. The current local setup can use `OPENAI_API_KEY`; if you have a Keygen endpoint, put `KEYGEN_URL` and `KEYGEN_TOKEN` there instead.
2. Run `node server.js` in this folder.
3. Open http://localhost:3000 in a browser.

## Done

- Saved the project brief in `BRIEF.md`.
- Built the Version 1 report form, privacy reminders, teacher/grade fields, two-step AI helper, and made-up examples.
- Added browser-only saving in `public/storage.js`.
- Kept the OpenAI request in `openai-helper.js` so the key stays on the server.
- Added server-only `getKey()`. On Vercel it reads `KEYGEN_URL` and `KEYGEN_TOKEN`, calls the Keygen URL with the token, and uses the returned AI key. The browser never sees either secret.
- `.env` remains ignored by Git.
- Saves on this computer only for now.

## Verification

- The page opens at `http://localhost:3000`.
- The local health route returns 200 at `http://localhost:3000/api/health`.
- The server-side Keygen flow was tested with a local stub and correctly passed the bearer token and read the returned key.
- Made-up sample reports load from browser storage.
- Choosing “I don't know” shows the teacher-name field.
- The AI route is connected and shows a friendly key/internet message when the local environment cannot reach OpenAI.
- A real local AI request reached OpenAI, but the existing local key was rejected as invalid. A valid local key or working `KEYGEN_URL`/`KEYGEN_TOKEN` pair is still needed for a successful live AI answer.

## Vercel

- Vercel uses `api/analyze.js` as the small Node.js server function and serves the `public` folder as the page.
- Import this GitHub repository into Vercel with the project root set to the repository root. No build command or output-directory override is needed.
- In Vercel Project Settings → Environment Variables, add `KEYGEN_URL` and `KEYGEN_TOKEN` for the environments you will use (usually Preview and Production; add Development too if using `vercel dev`).
- `KEYGEN_TOKEN` is sent only from the server to `KEYGEN_URL`. The returned AI key is used only inside the server function.
- Vercel does not need `OPENAI_API_KEY`, and no AI key or token belongs in GitHub. After adding or changing the two variables, redeploy.
- Browser saving stays local; Vercel does not store reports.

## Design refresh

- Reworked the visual design with stronger colors, a friendly shield hero, a three-step story, clearer buttons, and more welcoming student-focused cards.

## MVP checks

- Describe a report and click “Ask the AI what to notice.”
- Try “I don't know” for grade and confirm the teacher field appears.
- Answer the AI questions and click “Get my safe next step.”
- Click “Save this report on this computer” and confirm it appears in Made-up examples / saved reports.

## Maybe Later

- Nothing yet.

## Next

- Test the real AI call with the local key and collect safe video evidence.
- Replace browser-only storage with a school-approved database after the MVP is reviewed.
