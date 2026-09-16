// background.js
const videoContexts = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_CONTEXT_CHANGED' && sender.tab?.id) videoContexts.set(sender.tab.id, message.context);
  if (message.type === 'GET_CACHED_VIDEO_CONTEXT') sendResponse(videoContexts.get(sender.tab?.id) || null);
});

chrome.tabs.onRemoved.addListener((tabId) => videoContexts.delete(tabId));
