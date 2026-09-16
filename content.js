// YouTube is a single-page app: a normal page-load listener is not enough.
(() => {
if (globalThis.__geniusContextVersion === '3.0.2') return;
globalThis.__geniusContextVersion = '3.0.2';
let lastSignature = '';
let navigating = false;
let updateTimer;

function text(selector) {
  return document.querySelector(selector)?.textContent?.trim() || '';
}

function getVideoContext() {
  if (navigating || location.pathname !== '/watch') return { title: '', videoId: '', url: location.href };
  const title = text('h1.ytd-watch-metadata yt-formatted-string') ||
    text('#title h1 yt-formatted-string') || text('ytd-watch-metadata h1') ||
    document.querySelector('meta[property="og:title"]')?.content?.trim() || '';
  const channel = text('#owner #channel-name a') || text('ytd-video-owner-renderer #channel-name a');
  const videoId = new URL(location.href).searchParams.get('v') || '';
  return { title, channel, videoId, url: location.href };
}

function announceIfChanged() {
  const context = getVideoContext();
  const signature = `${context.videoId}|${context.title}|${context.channel || ''}`;
  if (signature !== lastSignature) {
    lastSignature = signature;
    chrome.runtime.sendMessage({ type: 'VIDEO_CONTEXT_CHANGED', context }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_VIDEO_CONTEXT') sendResponse(getVideoContext());
});

function scheduleUpdate() {
  // Continuous page mutations must not postpone detection forever.
  if (updateTimer) return;
  updateTimer = setTimeout(() => { updateTimer = null; announceIfChanged(); }, 350);
}
addEventListener('yt-navigate-start', () => { navigating = true; announceIfChanged(); });
addEventListener('yt-navigate-finish', () => { navigating = false; scheduleUpdate(); });
new MutationObserver(scheduleUpdate).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
announceIfChanged();
})();
