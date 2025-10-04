# XUND Chatbot Standalone

This project hosts a Vue 3 single-page application that embeds the XUND Digital Health Assistant chatbot. Besides the usual development instructions, this README documents every API call the frontend issues while guiding a user through a symptom check.

## Project setup

```sh
npm install
```

### Compile and hot-reload for development

```sh
npm run dev
```

### Type-check, compile, and minify for production

```sh
npm run build
```

### Run unit tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

## Environment variables

The application relies on the following Vite environment variables to communicate with the backend APIs:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | ✅ | Base URL of the XUND chatbot backend (e.g., `https://api.xund.ai`). |
| `VITE_CLIENT_ID` | ✅ | OAuth client identifier used when requesting an access token. |
| `VITE_API_KEY` | ✅ | OAuth client secret used when requesting an access token. |
| `VITE_CHATBOT_LANGUAGE` | ❌ | Optional language code sent with every chatbot request. Defaults to `en` when omitted. |

## Authentication flow

1. **Request an OAuth access token** – On application mount the client performs a `POST` request to `https://login.xund.solutions/api/token` (proxied through `https://corsanywhere-1tux.onrender.com/proxy`). The payload contains the `clientId`, `clientSecret`, and the `grant_type` `client_credentials`. The response returns an `access_token` that is stored for subsequent requests.【F:src/App.vue†L1-L38】
2. **Initialize the symptom check** – After obtaining the token, the client calls `POST {VITE_SERVER_URL}/v1/chatbot/initialize/symptomCheck`. The request includes the `Authorization: Bearer <access_token>` header as well as a `language` header derived from `VITE_CHATBOT_LANGUAGE`. The response contains a `checkId` that uniquely identifies the current chatbot session.【F:src/App.vue†L20-L38】

The access token and `checkId` are cached in Pinia stores and reused for all other API calls.【F:src/components/ChatboxComp.vue†L41-L73】

## Core chatbot requests

All subsequent requests include the following headers:

- `Authorization: Bearer <access_token>`
- `check-id: <checkId>`
- `language: <VITE_CHATBOT_LANGUAGE | 'en'>`

### 1. Retrieve existing conversation state

- **Endpoint:** `GET {VITE_SERVER_URL}/v1/chatbot/status`
- **Purpose:** Fetches the list of previously asked questions when resuming a session. The first unanswered question becomes the active prompt in the UI.【F:src/components/ChatboxComp.vue†L132-L186】

### 2. Fetch the next question

- **Endpoint:** `GET {VITE_SERVER_URL}/v1/chatbot/question`
- **Query parameters:**
  - `optionTop` – Maximum number of options to request (defaults to `34`).
  - `optionSkip` – Offset used when paginating long option lists.
  - `optionSearchTerm` – Search term when filtering selectable options.
- **Purpose:** Retrieves the next question in the flow, optionally appending or filtering selectable options. When the backend returns an informational question (`type === 'INFO'`) the client immediately auto-submits it to progress the flow.【F:src/components/ChatboxComp.vue†L194-L314】

### 3. Submit an answer

- **Endpoint:** `POST {VITE_SERVER_URL}/v1/chatbot/answer`
- **Body:**
  - `questionId` – Identifier of the question being answered.
  - `answer` – Either `{ id: <optionId> }` for predefined options or `{ value: <freeText> }` for text responses. Skips are submitted with an empty payload besides the `questionId`.
- **Purpose:** Sends the user’s answer and triggers retrieval of the next question. After submission the client refreshes the question list using the parameters described above.【F:src/components/ChatboxComp.vue†L316-L392】【F:src/components/ChatboxComp.vue†L440-L486】

## Overview management

Certain questions instruct the client to present an overview of the collected symptoms. While those questions are active the UI performs additional requests:

1. **Fetch current overview** – `GET {VITE_SERVER_URL}/v1/chatbot/overview`
   - Returns two arrays: `addedSymptoms` and `suggestedNotAddedSymptoms`. The data populates the review cards in the conversation.【F:src/components/ChatboxComp.vue†L226-L274】
2. **Confirm overview** – `POST {VITE_SERVER_URL}/v1/chatbot/overview/confirm`
   - Invoked when the user acknowledges the overview card to resume the symptom check.【F:src/components/ChatboxComp.vue†L488-L524】
3. **Add suggested symptom** – `POST {VITE_SERVER_URL}/v1/chatbot/overview/symptoms`
   - Body: `{ symptomIds: [<symptomId>] }`
   - Adds a recommended symptom to the current case and refreshes the overview data.【F:src/components/ChatboxComp.vue†L526-L560】

## Symptom check report

When the backend signals that a report is available (`detailedType === 'SYMPTOM_CHECK_REPORT'`) the client retrieves both the JSON payload and its PDF representation:

1. **Get report summary** – `GET {VITE_SERVER_URL}/v1/chatbot/report`
   - Returns metadata such as the API version and report content, which is stored for display.【F:src/components/ChatboxComp.vue†L330-L372】
2. **Get report PDF** – `GET {VITE_SERVER_URL}/v1/chatbot/report/pdf`
   - Requested with `responseType: 'blob'` to download the binary PDF. The file is converted to an object URL for display or download links in the UI.【F:src/components/ChatboxComp.vue†L372-L392】

## Error handling

Every axios request funnels through the `normalizeError` helper, which converts Axios errors into human-readable messages, preferring backend-supplied messages when present. These messages are shown inside the chat UI if a request fails.【F:src/components/ChatboxComp.vue†L562-L620】

