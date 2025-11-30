
# Bua XI - The Digital Soundprint of South Africa

## Prerequisites
- Node.js (Latest LTS recommended)
- A valid Bua/Model API Key

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup:**
    - Create a `.env` file in the root directory (copy from `.env.example`).
    - Add your API Key. 
    - **Multi-Key Support:** To enable automatic failover (e.g., if one key runs out of quota), you can add multiple keys separated by commas:
      ```
      API_KEY=key_one_here,key_two_here,key_three_here
      ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```

4.  **Open in Browser:**
    Click the link provided in the terminal (usually http://localhost:5173).

## Deployment to GitHub Pages

1.  Push your code to GitHub.
2.  Go to **Settings** > **Secrets and variables** > **Actions**.
3.  Click **New repository secret**.
4.  **Name:** `API_KEY`
5.  **Value:** Paste your API key(s). 
    *   *For multiple keys:* Paste them as a single string separated by commas (e.g., `AIzaSy...1,AIzaSy...2`).
6.  The GitHub Action defined in `.github/workflows/static.yml` will automatically build and deploy the site.

## Live API — models & endpoints (short FAQ)

Q: What is the correct model and API endpoint to use for Live API voice development?

Recommended model for Live/voice development (use this for dev and tests): `gemini-live-2.5-flash-preview` — this is the fastest realtime model and the recommended default in this repo. It supports audio-in, audio-out, vision, tool-calls, and barge-in (low-latency).
NOTE: For lower-latency realtime usage prefer `gemini-live-2.5-flash-preview`. The previous native audio model (`gemini-2.5-flash-native-audio-preview-09-2025`) remains available as an optional high-quality mode but is slower.
- Endpoint: Do NOT manually set or construct a WebSocket endpoint for Live sessions. The client SDK negotiates and resolves the correct realtime endpoint automatically inside client.live.connect() — don't override it. In this repo we rely on the SDK to manage the endpoint and the correct protocol/host.

Q: What can I use with an AI Studio API key / free tier?

- Google AI Studio API keys generally work for Live API development and are compatible with the flash preview model `gemini-live-2.5-flash-preview` (this is the model recommended in repo examples). Preview models may still require account-level access/preview enablement in some cases — check your AI Studio project model list and quotas in the console if you see permission errors.

If you'd like I can add a small “Model & Endpoint” modal in the app UI that surfaces the active model and resolved SDK endpoint when a session starts (useful for debugging). Would you like that next?
```