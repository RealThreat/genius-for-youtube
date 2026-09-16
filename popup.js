// Replace this client token if Genius revokes it: https://genius.com/api-clients
// Create a token at https://genius.com/api-clients and set it locally before loading.
const GENIUS_ACCESS_TOKEN = 'YOUR_GENIUS_ACCESS_TOKEN';
const $ = id => document.getElementById(id);
let lyricsSize = Number(localStorage.getItem('lyricsSize')) || 17;
function changeLyricsSize(delta) {
  lyricsSize = Math.min(24, Math.max(13, lyricsSize + delta));
  document.documentElement.style.setProperty('--lyrics-size', lyricsSize + 'px');
  localStorage.setItem('lyricsSize', String(lyricsSize));
}
changeLyricsSize(0);
$('font-smaller').addEventListener('click', () => changeLyricsSize(-1));
$('font-larger').addEventListener('click', () => changeLyricsSize(1));
let activeTab, requestId = 0, currentHits = [];
let selectedHitId = null;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'VIDEO_CONTEXT_CHANGED' || sender.tab?.id !== activeTab?.id) return;
  if (!message.context?.title) {
    ++requestId;
    currentHits = [];
    $('video-title').textContent = 'En attente de la vidéo…';
    showError('Ouvre une vidéo ou attends la fin du chargement.');
    return;
  }
  loadLyrics();
});

document.addEventListener('DOMContentLoaded', init);
$('refresh').addEventListener('click', () => loadLyrics());
$('retry').addEventListener('click', showMatches);
$('match').addEventListener('change', e => { if (e.target.value !== '') loadHit(currentHits[Number(e.target.value)]); });

async function init() {
  [activeTab] = await chrome.tabs.query({active:true, currentWindow:true});
  if (!activeTab?.url?.match(/^https:\/\/(www\.)?youtube\.com\/watch/)) return showError('Ouvre une vidéo YouTube complète pour afficher les paroles.');
  await loadLyrics();
}
async function getContext() {
  if (!activeTab?.id) throw new Error('Ouvre le popup depuis une vidéo YouTube.');
  try {
    return await chrome.tabs.sendMessage(activeTab.id, {type:'GET_VIDEO_CONTEXT'});
  } catch {
    // Already-open tabs do not receive content scripts when an extension reloads.
    try {
      await chrome.scripting.executeScript({target:{tabId:activeTab.id}, files:['content.js']});
      return await chrome.tabs.sendMessage(activeTab.id, {type:'GET_VIDEO_CONTEXT'});
    } catch {
      throw new Error('Connexion à YouTube impossible. Recharge la page YouTube puis rouvre l’extension.');
    }
  }
}
async function loadLyrics() {
  currentHits = [];
  selectedHitId = null;
  $('retry').disabled = true;
  const id = ++requestId;
  let context;
  try {
    context = await getContext();
    for (let attempt = 0; !context?.title && attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      if (id !== requestId) return;
      context = await getContext();
    }
  } catch (error) {
    if (id === requestId) showError(error.message);
    return;
  }
  if (id !== requestId) return;
  if (!context?.title) return showError('Le titre est encore en cours de chargement. Réessaie dans un instant.');
  $('video-title').textContent = context.title; setLoading('Recherche de la meilleure version sur Genius…');
  try {
    const hits = await findMatches(context);
    if (id !== requestId) return; // Never display lyrics for the previous YouTube video.
    currentHits = hits;
    if (!currentHits.length) return showError('Aucune correspondance suffisamment fiable pour cette vidéo.');
    $('retry').disabled = false;
    populateMatches(); await loadHit(currentHits[0], id);
  } catch (e) { if (id === requestId) showError(`Recherche impossible : ${e.message}`); }
}
function setLoading(message) { $('status').className=''; $('status').textContent=message; $('lyrics').className='loading'; $('lyrics').textContent='Chargement…'; $('open').style.display='none'; $('match').style.display='none'; $('refresh').disabled=true; }
function showError(message) { $('refresh').disabled=false; $('status').className='error'; $('status').textContent=message; $('lyrics').className='empty'; $('lyrics').textContent=''; $('open').style.display='none'; }
function populateMatches() { $('match').replaceChildren(new Option('Choisir un morceau…', ''), ...currentHits.map((h,i)=>new Option(h.full_title,i))); $('match').value = selectedHitId === null ? '' : String(currentHits.findIndex(h => h.id === selectedHitId)); }
function showMatches() { if (!currentHits.length) return; populateMatches(); $('match').style.display='block'; $('status').className=''; $('status').textContent='Choisis une autre version pour charger ses paroles.'; }
async function loadHit(hit, id = ++requestId) {
  if (!hit) return; selectedHitId = hit.id; $('match').value=String(currentHits.indexOf(hit)); setLoading('Récupération des paroles…');
  try {
    const lyrics=await fetchLyricsPage(hit.url); if (id !== requestId) return;
    $('refresh').disabled=false; $('status').className=''; $('status').textContent=lyrics ? hit.full_title : 'Paroles indisponibles — essaie un autre résultat.'; $('lyrics').className=''; $('lyrics').textContent=lyrics || 'Cette page Genius ne contient pas de paroles exploitables.';
    $('lyrics').scrollTop = 0;
    $('open').href=hit.url; $('open').style.display='block';
  } catch(e) { if(id===requestId) showError(`Impossible de récupérer les paroles : ${e.message}`); }
}
function stripNoise(v) { return v.replace(/\[[^\]]*(official|video|audio|lyrics?|paroles|visualizer|4k|8k|hd|mv|live)[^\]]*\]/gi,' ').replace(/\(([^)]*\b(official|video|audio|lyrics?|paroles|visualizer|4k|8k|hd|mv)\b[^)]*)\)/gi,' ').replace(/\s*\|\s*(official|lyrics?|audio|video).*$/i,' ').replace(/\s+/g,' ').trim(); }
function cleanChannel(v='') { return v.replace(/\s*-\s*topic$/i,'').replace(/vevo$/i,'').trim(); }
function isJapanese(v) { return /[\u3040-\u30ff\u3400-\u9fff]/.test(v); }
function tokens(v='') { return v.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ').filter(Boolean); }
function overlap(a,b) { const set=new Set(b); return a.length ? a.filter(x=>set.has(x)).length/a.length : 0; }
async function findMatches(context) {
  const cleaned = stripNoise(context.title);
  const parts = cleaned.split(/\s+[-–—]\s+/);
  const artist = parts.length > 1 ? parts[0].trim() : cleanChannel(context.channel);
  const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleaned;
  const japanese = isJapanese(title);
  // A channel/collective suffix can hide the original song in Genius search.
  // Keep the original query, and also search the song name independently.
  const queries = [...new Set([`${artist} ${title}`.trim(), title, cleaned,
    japanese ? `${title} romanized` : ''].filter(Boolean))];
  const responses = await Promise.allSettled(queries.map(searchGenius));
  const successful = responses.filter(r => r.status === 'fulfilled');
  if (!successful.length) throw responses[0].reason;
  const raw = successful.flatMap(r => r.value), seen = new Set(), titleWords = tokens(title), artistWords = tokens(artist);
  return raw.filter(h=>!seen.has(h.id)&&seen.add(h.id)).map(hit=>({hit,score:score(hit,titleWords,artistWords,japanese)})).filter(x=>x.score>=.28).sort((a,b)=>b.score-a.score).map(x=>x.hit).slice(0,12);
}
function score(hit,titleWords,artistWords,wantsRomanized) {
  const label=`${hit.title} ${hit.full_title}`;
  const titleMatch = overlap(titleWords, tokens(hit.title));
  if (titleMatch < .5) return 0;
  let score = titleMatch * .72 + overlap(artistWords, tokens(hit.primary_artist?.name || '')) * .28;
  // Romanization is a preference, never evidence that this is the right song.
  if (score < .28) return 0;
  if (/translation|traducci|traduction|tradu[cç][aã]o|translated/i.test(`${label} ${hit.primary_artist?.name || ''}`)) score -= .65;
  else if(wantsRomanized) score+=/romanized|romaji/i.test(label)?.25:-.08;
  else if(/romanized|romaji/i.test(label)) score-=.42;
  return score;
}
async function searchGenius(query) { const r=await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${GENIUS_ACCESS_TOKEN}`}}); if(!r.ok) throw new Error(`Genius répond ${r.status}`); const d=await r.json(); return (d.response?.hits||[]).filter(x=>x.type==='song').map(x=>x.result); }
async function fetchLyricsPage(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Genius répond ${r.status}`);
  const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
  return [...doc.querySelectorAll('[data-lyrics-container="true"]')].map(node => {
    // A detached document has no layout: preserve line breaks explicitly.
    node.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    node.querySelectorAll('script, style').forEach(element => element.remove());
    return node.textContent.trim();
  }).join('\n\n').replace(/^\d+ Contributors?\s*/im, '').trim();
}
