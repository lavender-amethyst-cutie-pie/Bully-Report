# Bully Report

After each save point, push it to GitHub.

OpenAI model: 5.6 Luna

## How to run

1. Make sure the local `.env` file has your OpenAI key.
2. Run `node server.js` in this folder.
3. Open http://localhost:3000 in a browser.

## Done

- Saved the project brief in `BRIEF.md`.
- Built the Version 1 report form, privacy reminders, teacher/grade fields, two-step AI helper, and made-up examples.
- Added browser-only saving in `public/storage.js`.
- Kept the OpenAI request in `openai-helper.js` so the key stays on the server.
- `.env` remains ignored by Git.
- Saves on this computer only for now.

## Verification

- The page opens at `http://localhost:3000`.
- Made-up sample reports load from browser storage.
- Choosing “I don't know” shows the teacher-name field.
- The AI route is connected and shows a friendly key/internet message when the local environment cannot reach OpenAI.

## Vercel

- Vercel uses `api/analyze.js` as the small server function and serves the `public` folder as the page.
- In Vercel Project Settings, add `OPENAI_API_KEY` as an Environment Variable for Development, Preview, and Production.
- No other Vercel environment variable is required; the model is set in `openai-helper.js` from the 5.6 Luna note.
- After adding or changing the key, redeploy so the new value is used.
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
