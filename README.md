# Genius for YouTube

> A lightweight Chrome extension that brings the right Genius lyrics to the YouTube track you are listening to.

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate)

## What it does

- Detects the current YouTube video, including YouTube single-page navigation.
- Searches Genius using the song title and artist with a ranked match instead of blindly taking the first result.
- Filters noisy YouTube suffixes and translation pages.
- Handles accented and non-Latin titles, with a preference for Romanized/Romaji pages for Japanese tracks.
- Lets you switch to another Genius result when a video title is ambiguous.
- Keeps lyrics readable with a dark, resizable popup and preserved line breaks.

## Installation

### 1. Create a Genius API token

Create a client at [Genius API Clients](https://genius.com/api-clients) and copy your access token.

### 2. Configure the extension locally

Open [popup.js](popup.js) and replace:

~~~js
const GENIUS_ACCESS_TOKEN = 'YOUR_GENIUS_ACCESS_TOKEN';
~~~

with your token. Keep this change in your local copy. Never commit the token to a public repository.

### 3. Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the cloned/downloaded repository folder.
5. Pin the extension for quick access from the toolbar.

## Usage

1. Open a YouTube video.
2. Click the Genius for YouTube icon.
3. The best matching Genius page loads automatically.
4. Use **Change result** if the video title is ambiguous.
5. Use **A− / A+** to adjust the lyrics size.

## Troubleshooting

- **The title is still loading:** wait for YouTube to finish loading, then click **Refresh**.
- **No reliable match:** click **Change result** after a broader search.
- **Genius returns an API error:** check that your local token is valid and has not been revoked.
- **The popup cannot connect to YouTube:** reload the extension and the YouTube tab.

## Privacy

The extension reads the title and channel of the active YouTube tab and sends search requests to the Genius API. It includes no analytics, accounts, personal paths, or telemetry. The public repository contains a token placeholder only.

## License

No license has been selected yet. Add one before distributing a derivative or production release.
