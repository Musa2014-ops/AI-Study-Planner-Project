# Local Gemini Integration Plan

StudyBuddy currently stores data in browser `localStorage`, so there is no need for SQL at this stage.

## Current approach

- user accounts are stored under `studyBuddyAccounts`
- the logged-in user is stored under `studyBuddySession`
- Gemini configuration is stored under `studyBuddyAIConfig`

These keys are implemented in [`script.js`](c:/Users/maahe/Desktop/University/Year%202/Computing%20Project%202/AI-Study-Planner-Project/script.js).

## Gemini placeholder

The file [`integration/gemini-config.example.json`](c:/Users/maahe/Desktop/University/Year%202/Computing%20Project%202/AI-Study-Planner-Project/integration/gemini-config.example.json) shows how a Gemini configuration object would look.

The app now also prepares a local implementation preview object in the browser:

`window.studyBuddyImplementationPreview`

That object contains:

- the local storage keys
- the Gemini configuration object
- the payload that would be sent to Gemini for study-plan generation
- a sample note-organisation payload

## Report-friendly explanation

Gemini can be integrated without changing the storage layer to SQL. In this prototype, the application keeps user data in `localStorage` using JavaScript objects and JSON. A separate Gemini configuration object is also stored locally. When the AI feature is implemented, the app would take the current tasks or notes, build a structured JSON payload, and send it to Gemini to organise notes or generate a study plan.

At this stage, no real API key is required. The project includes the configuration shape and the request payload structure so the intended integration can be clearly demonstrated.
