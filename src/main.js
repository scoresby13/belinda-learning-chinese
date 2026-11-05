/**
 * Belinda Learning Chinese — Audio Player & Karaoke Engine
 * Co-developed by Gemini (data + sync engine) & Claude (UI/UX + rendering)
 */

// ───────────────────────────── State ─────────────────────────────
const state = {
  currentCourse: null,
  currentTrackData: null,
  currentTrackId: null,
  activeSegmentIndex: -1,
  activeWordIndex: -1,
  isPinyinVisible: true,
  isToneColorOn: false,
  isAutoScrollEnabled: true,
  isUserScrolling: false,
  isLoopingSentence: false,
  isScrubbing: false,
  userScrollTimeout: null,
  playbackSpeed: 1.0,
  theme: 'zen',
  lastSyncedTime: -1
};

const USER_SCROLL_RESUME_MS = 6000;
const DESKTOP_BREAKPOINT = 1024;

// ───────────────────────────── DOM cache ─────────────────────────────
const $ = (id) => document.getElementById(id);
const elements = {
  app: $('app'),
  audio: $('nativeAudio'),
  transcriptStream: $('transcriptStream'),
  currentTrackHeader: $('currentTrackHeader'),
  lessonEyebrow: $('lessonEyebrow'),
  lessonTitle: $('lessonTitle'),
  playingBadge: $('playingBadge'),
  playingTitle: $('playingTitle'),

  playPauseBtn: $('playPauseBtn'),
  playIcon: $('playIcon'),
  pauseIcon: $('pauseIcon'),
  skipBackBtn: $('skipBackBtn'),
  skipForwardBtn: $('skipForwardBtn'),
  loopSentenceBtn: $('loopSentenceBtn'),

  timelineContainer: $('timelineContainer'),
  timelineProgress: $('timelineProgress'),
  timelineHandle: $('timelineHandle'),
  timelineSegment: $('timelineSegment'),
  timelineTicks: $('timelineTicks'),
  timelineTooltip: $('timelineTooltip'),
  currentTimeDisplay: $('currentTimeDisplay'),
  durationTimeDisplay: $('durationTimeDisplay'),

  togglePinyinBtn: $('togglePinyinBtn'),
  toggleTonesBtn: $('toggleTonesBtn'),
  toggleAutoScrollBtn: $('toggleAutoScrollBtn'),
  toggleThemeBtn: $('toggleThemeBtn'),
  toggleSidebarBtn: $('toggleSidebarBtn'),
  closeSidebarBtn: $('closeSidebarBtn'),
  sidebarScrim: $('sidebarScrim'),
  courseSidebar: $('courseSidebar'),
  courseTree: $('courseTree'),
  resumeScrollBanner: $('resumeScrollBanner'),
  resumeScrollBtn: $('resumeScrollBtn'),

  prevLineBtn: $('prevLineBtn'),
  nextLineBtn: $('nextLineBtn'),
  lineCounter: $('lineCounter'),

  speedBtn: $('speedBtn'),
  speedValue: $('speedValue'),
  speedMenu: $('speedMenu')
};

// ───────────────────────────── Helpers ─────────────────────────────
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => window.innerWidth >= DESKTOP_BREAKPOINT;

function getDuration() {
  const d = elements.audio.duration;
  return Number.isFinite(d) && d > 0 ? d : (state.currentTrackData?.durationSeconds || 30);
}

// ─────────────── Hanzi ⇄ Pinyin alignment & tone detection ───────────────
const HAN_RE = /\p{Script=Han}/u;
const TONE_MARKS = [
  'āēīōūǖĀĒĪŌŪǕ',
  'áéíóúǘÁÉÍÓÚǗ',
  'ǎěǐǒǔǚǍĚǏǑǓǙ',
  'àèìòùǜÀÈÌÒÙǛ'
];

function toneOf(syllable = '') {
  for (const ch of syllable.normalize('NFC')) {
    for (let t = 0; t < 4; t++) if (TONE_MARKS[t].includes(ch)) return t + 1;
  }
  // Numbered pinyin fallback (e.g. "hao3")
  const m = syllable.match(/([1-5])$/);
  return m ? Number(m[1]) : 5;
}

/** Split a pinyin string into bare syllables, dropping punctuation like "·", ",", "." */
function pinyinSyllables(pinyin = '') {
  return pinyin
    .split(/\s+/)
    .map((s) => s.replace(/^[^\p{L}\p{M}0-9]+|[^\p{L}\p{M}0-9]+$/gu, ''))
    .filter(Boolean);
}

/**
 * Pair each Han character with its syllable. Returns null if the counts
 * don't line up (the renderer then falls back to a pinyin line above).
 */
function alignHanziPinyin(hanzi = '', pinyin = '') {
  const chars = Array.from(hanzi);
  const syllables = pinyinSyllables(pinyin);
  const hanCount = chars.filter((c) => HAN_RE.test(c)).length;
  if (!hanCount || hanCount !== syllables.length) return null;
  let s = 0;
  return chars.map((ch) => (HAN_RE.test(ch) ? { ch, py: syllables[s++] } : { ch, py: null }));
}

function glyphHtml({ ch, py }) {
  if (py === null) {
    return `<ruby class="glyph punct"><span class="glyph-han">${escapeHtml(ch)}</span><rt aria-hidden="true"></rt></ruby>`;
  }
  return `<ruby class="glyph tone-${toneOf(py)}"><span class="glyph-han">${escapeHtml(ch)}</span><rt>${escapeHtml(py)}</rt></ruby>`;
}

/** Glyph run with kinsoku: punctuation is glued to the preceding character. */
function glyphRunHtml(pairs) {
  let html = '';
  for (let i = 0; i < pairs.length; i++) {
    const next = pairs[i + 1];
    if (next && next.py === null && pairs[i].py !== null) {
      let group = glyphHtml(pairs[i]);
      while (pairs[i + 1] && pairs[i + 1].py === null) group += glyphHtml(pairs[++i]);
      html += `<span class="nobr">${group}</span>`;
    } else {
      html += glyphHtml(pairs[i]);
    }
  }
  return html;
}

/** Whole-sentence Mandarin block (Hanzi with Pinyin above). */
function mandarinBlockHtml(hanzi, pinyin, size = 'lg') {
  const pairs = alignHanziPinyin(hanzi, pinyin);
  if (pairs) {
    return `<div class="mandarin-block size-${size}" lang="zh-Hans"><span class="glyph-row">${glyphRunHtml(pairs)}</span></div>`;
  }
  return `<div class="mandarin-block size-${size}" lang="zh-Hans">
      ${pinyin ? `<span class="pinyin-line">${escapeHtml(pinyin)}</span>` : ''}
      <span class="glyph-row"><span class="glyph-han">${escapeHtml(hanzi)}</span></span>
    </div>`;
}

// ───────────────────────────── Init ─────────────────────────────
async function initApp() {
  loadStoredPreferences();
  setupEventListeners();
  if (!isDesktop()) setSidebarOpen(false, { focus: false });
  else setSidebarOpen(true, { focus: false });
  await loadCourseCatalog();
  await loadTrackData('data/foundation_cd01_track01.json', 'foundation-cd01-01');
  startAnimationFrameSync();
}

function loadStoredPreferences() {
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

  const savedPinyin = read('belinda_pinyin');
  if (savedPinyin !== null) state.isPinyinVisible = savedPinyin === 'true';
  applyPinyinState();

  state.isToneColorOn = read('belinda_tones') === 'true';
  applyToneState();

  state.theme = document.documentElement.getAttribute('data-theme') || read('belinda_theme') || 'zen';
  applyTheme();

  const savedSpeed = parseFloat(read('belinda_speed'));
  if (Number.isFinite(savedSpeed)) setPlaybackSpeed(savedSpeed, { persist: false });
}

function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

// ───────────────────────────── Curriculum ─────────────────────────────
async function loadCourseCatalog() {
  try {
    const res = await fetch('./data/course_index.json');
    state.currentCourse = await res.json();
    renderCourseTree(state.currentCourse);
  } catch (err) {
    console.error('Failed to load course index:', err);
    elements.courseTree.innerHTML = `<p class="error-msg">Could not load course catalog.</p>`;
  }
}

const LEVEL_HANZI = { foundation: '基础', advanced: '进阶', vocabulary: '词汇' };
const CHEVRON = `<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

function renderCourseTree(catalog) {
  if (!catalog || !catalog.levels) return;

  const html = catalog.levels.map((level) => {
    const ready = level.discs.filter((d) => d.tracks && d.tracks.length).length;
    const discs = level.discs.map((disc) => {
      const tracks = disc.tracks || [];
      const hasTracks = tracks.length > 0;
      const discId = `disc-${level.id}-${disc.cd}`;
      const containsActive = tracks.some((t) => t.id === state.currentTrackId);
      const expanded = hasTracks && (containsActive || (level.id === 'foundation' && disc.cd === 1));

      const items = tracks.map((tr) => {
        const available = Boolean(tr.dataFile);
        const name = escapeHtml(tr.title.replace(/^Track\s*\d+:\s*/i, ''));
        return `<li>
          <button class="track-item ${available ? '' : 'disabled'} ${tr.id === state.currentTrackId ? 'active' : ''}"
            ${available ? `data-file="${escapeHtml(tr.dataFile)}"` : 'aria-disabled="true"'}
            data-id="${escapeHtml(tr.id)}" title="${escapeHtml(tr.title)}${available ? '' : ' — transcript coming soon'}">
            <span class="track-num">${String(tr.track).padStart(2, '0')}</span>
            <span class="track-name">${name}</span>
            <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </li>`;
      }).join('');

      const availableCount = tracks.filter((t) => t.dataFile).length;
      const meta = hasTracks
        ? `${tracks.length} tracks · ${availableCount} ready`
        : 'Transcription pending';

      return `<div class="disc-group ${hasTracks ? 'has-tracks' : ''} ${expanded ? 'expanded' : ''}">
        <button class="disc-toggle" ${hasTracks ? `aria-expanded="${expanded}" aria-controls="${discId}"` : 'disabled'}>
          <span class="disc-num">${disc.cd}</span>
          <span class="disc-label">
            <span class="disc-name">${escapeHtml(disc.title)}</span>
            <span class="disc-meta">${meta}</span>
          </span>
          ${hasTracks ? CHEVRON : '<span class="soon-pill">Soon</span>'}
        </button>
        ${hasTracks ? `<div class="track-list-wrap" id="${discId}"><ul class="track-list">${items}</ul></div>` : ''}
      </div>`;
    }).join('');

    return `<section class="level-section">
      <h3 class="level-title">
        <span class="level-hanzi" lang="zh-Hans">${LEVEL_HANZI[level.id] || ''}</span>
        <span class="level-name">${escapeHtml(level.title.replace(/^Chinese\s+/i, ''))}</span>
        <span class="level-count">${ready}/${level.discs.length} CDs</span>
      </h3>
      ${discs}
    </section>`;
  }).join('');

  elements.courseTree.innerHTML = html;

  elements.courseTree.querySelectorAll('.disc-toggle[aria-controls]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.disc-group');
      const open = !group.classList.contains('expanded');
      group.classList.toggle('expanded', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  elements.courseTree.querySelectorAll('.track-item[data-file]').forEach((item) => {
    item.addEventListener('click', () => {
      loadTrackData(item.dataset.file, item.dataset.id);
      if (!isDesktop()) setSidebarOpen(false);
    });
  });
}

function markActiveTrack() {
  elements.courseTree.querySelectorAll('.track-item').forEach((i) => {
    const on = i.dataset.id === state.currentTrackId;
    i.classList.toggle('active', on);
    if (on) i.setAttribute('aria-current', 'true'); else i.removeAttribute('aria-current');
  });
}

// ───────────────────────────── Track loading ─────────────────────────────
async function loadTrackData(jsonPath, trackId) {
  try {
    const res = await fetch(jsonPath);
    const data = await res.json();
    state.currentTrackData = data;
    state.currentTrackId = trackId || data.trackId;

    const shortTitle = data.title.replace(/^.*?Track\s*\d+:\s*/i, '');
    const discLabel = `${data.course.replace(/^Chinese\s+/i, '')} · CD ${data.cd} · Track ${data.track}`;

    elements.currentTrackHeader.textContent = discLabel;
    elements.lessonEyebrow.textContent = discLabel;
    elements.lessonTitle.textContent = shortTitle;
    elements.playingBadge.textContent = `CD ${data.cd} · Track ${data.track}`;
    elements.playingTitle.textContent = shortTitle;
    document.title = `${shortTitle} — Belinda Learning Chinese`;

    elements.audio.src = data.audioUrl;
    elements.audio.load();
    elements.audio.playbackRate = state.playbackSpeed;

    renderTranscriptCards(data.segments);
    renderTimelineTicks();
    markActiveTrack();

    state.activeSegmentIndex = -1;
    state.activeWordIndex = -1;
    state.lastSyncedTime = -1;
    updateLineNav();
    updateProgressUI();
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (err) {
    console.error('Failed to load track data:', err);
    elements.transcriptStream.innerHTML = `<p class="error-msg">Failed to load transcript data.</p>`;
  }
}

// ───────────────────────────── Transcript rendering ─────────────────────────────
const SPEAKERS = {
  teacher:      { cls: 'teacher', glyph: '师', role: 'Teacher' },
  student:      { cls: 'student', glyph: '生', role: 'Student' },
  native_guide: { cls: 'native',  glyph: '范', role: 'Native speaker' },
  announcer:    { cls: 'announcer', glyph: '序', role: 'Narrator' }
};

function speakerMeta(seg) {
  const key = seg.speaker || '';
  const base = key.includes('teacher') ? SPEAKERS.teacher
    : key.includes('native') ? SPEAKERS.native_guide
    : (key.includes('announcer') || key.includes('intro')) ? SPEAKERS.announcer
    : SPEAKERS.student;
  // "Harold Goodman (Teacher)" → name "Harold Goodman", role "Teacher"
  let name = seg.speakerName || base.role;
  let role = base.role;
  const m = name.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) { name = m[1]; role = m[2]; }
  if (name === role) role = '';
  return { ...base, name, role };
}

function wordTokenHtml(w, segIdx, wIdx) {
  const attrs = `data-seg="${segIdx}" data-word="${wIdx}" data-start="${w.start}" data-end="${w.end}"`;
  if (w.hanzi && !w.text) {
    // Spoken Mandarin word: render glyphs so the sweep runs across Hanzi
    const pairs = alignHanziPinyin(w.hanzi, w.pinyin || '') ||
      Array.from(w.hanzi).map((ch) => ({ ch, py: HAN_RE.test(ch) ? '' : null }));
    return `<span class="word-token zh-word" ${attrs}>${glyphRunHtml(pairs)}</span>`;
  }
  if (w.hanzi) {
    // Mandarin word inside an English sentence: "…is hǎo 好"
    const tone = toneOf(w.pinyin || w.text);
    return `<span class="word-token zh-inline" ${attrs}><span class="py-word tone-${tone}">${escapeHtml(w.text || w.pinyin)}</span><span class="han-chip" lang="zh-Hans">${escapeHtml(w.hanzi)}</span></span>`;
  }
  return `<span class="word-token" ${attrs}>${escapeHtml(w.text)}</span>`;
}

function renderTranscriptCards(segments) {
  if (!segments || segments.length === 0) {
    elements.transcriptStream.innerHTML = `<p class="empty-state">No transcript segments found.</p>`;
    return;
  }

  const cardsHtml = segments.map((seg, idx) => {
    const sp = speakerMeta(seg);
    const words = Array.isArray(seg.words) ? seg.words : [];
    const isMandarinLine = seg.language === 'zh';
    let body = '';

    if (isMandarinLine) {
      // Spoken Mandarin: Hanzi is the lyric, English is the gloss
      const spoken = words.length && words.some((w) => w.hanzi)
        ? `<div class="mandarin-block size-lg" lang="zh-Hans"><span class="glyph-row">${words.map((w, i) => wordTokenHtml(w, idx, i)).join('')}</span></div>`
        : (seg.hanzi ? mandarinBlockHtml(seg.hanzi, seg.pinyin, 'lg') : '');
      body = `${spoken}${seg.english ? `<p class="gloss-en">${escapeHtml(seg.english)}</p>` : ''}`;
    } else {
      // Spoken English (or mixed): English is the lyric, Chinese is the companion line
      const spoken = words.length
        ? words.map((w, i) => wordTokenHtml(w, idx, i)).join(' ')
        : escapeHtml(seg.english || '');
      body = `<p class="spoken-en">${spoken}</p>
        ${seg.hanzi ? `<div class="gloss-zh">${mandarinBlockHtml(seg.hanzi, seg.pinyin, 'md')}</div>` : ''}`;
    }

    return `
      <article class="speech-card enter" id="card-${idx}" style="--i:${Math.min(idx, 12)}"
        data-index="${idx}" data-start="${seg.start}" data-end="${seg.end}"
        data-lang="${escapeHtml(seg.language || 'en')}" data-type="${escapeHtml(seg.type || '')}"
        tabindex="-1" aria-label="${escapeHtml(sp.name)} at ${formatTime(seg.start)}">
        <header class="card-header">
          <span class="speaker-tag ${sp.cls}">
            <span class="speaker-glyph" lang="zh-Hans" aria-hidden="true">${sp.glyph}</span>
            <span class="speaker-name">${escapeHtml(sp.name)}</span>
            ${sp.role ? `<span class="speaker-role">${escapeHtml(sp.role)}</span>` : ''}
          </span>
          <span class="card-actions">
            <span class="loop-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/></svg>
              Looping
            </span>
            <button class="time-badge" data-start="${seg.start}" aria-label="Play from ${formatTime(seg.start)}">
              <svg viewBox="0 0 24 24" height="9" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>
              ${formatTime(seg.start)}
            </button>
          </span>
        </header>
        <div class="sentence-body">${body}</div>
      </article>`;
  }).join('');

  elements.transcriptStream.innerHTML = cardsHtml;

  // Drop the entrance class once it has played so it can't re-trigger
  setTimeout(() => {
    elements.transcriptStream.querySelectorAll('.speech-card.enter').forEach((c) => c.classList.remove('enter'));
  }, 1400);

  elements.transcriptStream.querySelectorAll('.speech-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Don't hijack text selection
      if (window.getSelection && String(window.getSelection()).length > 0) return;
      const wordToken = e.target.closest('.word-token');
      const start = wordToken?.dataset.start ?? card.dataset.start;
      resumeFollowing();
      seekAudio(parseFloat(start));
    });
  });
}

function renderTimelineTicks() {
  const segs = state.currentTrackData?.segments || [];
  const dur = getDuration();
  elements.timelineTicks.innerHTML = segs
    .slice(1)
    .map((s) => `<i style="left:${(s.start / dur) * 100}%"></i>`)
    .join('');
}

// ───────────────────────────── Sync engine ─────────────────────────────
function startAnimationFrameSync() {
  function loop() {
    if (state.currentTrackData) {
      const curTime = elements.audio.currentTime;
      if (!elements.audio.paused || curTime !== state.lastSyncedTime) {
        state.lastSyncedTime = curTime;
        syncActiveSentence(curTime);
        syncActiveWord(curTime);
        if (!state.isScrubbing) updateProgressUI();
        checkSentenceLoop(curTime);
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function findSegmentIndex(currentTime) {
  const segments = state.currentTrackData?.segments || [];
  for (let i = 0; i < segments.length; i++) {
    if (currentTime >= segments[i].start && currentTime < segments[i].end) return i;
  }
  // Between lines: keep the most recent one active
  for (let i = segments.length - 1; i >= 0; i--) {
    if (currentTime >= segments[i].start) return i;
  }
  return -1;
}

function syncActiveSentence(currentTime) {
  if (!state.currentTrackData?.segments) return;
  const segments = state.currentTrackData.segments;
  const activeIdx = findSegmentIndex(currentTime);

  if (activeIdx !== state.activeSegmentIndex && activeIdx !== -1) {
    if (state.activeSegmentIndex !== -1) {
      const prevCard = $(`card-${state.activeSegmentIndex}`);
      if (prevCard) {
        prevCard.classList.remove('active');
        prevCard.style.setProperty('--seg-p', 0);
        prevCard.querySelectorAll('.word-token').forEach((t) => {
          t.classList.remove('active-word', 'spoken');
          t.style.removeProperty('--p');
        });
      }
    }

    state.activeSegmentIndex = activeIdx;
    state.activeWordIndex = -1;
    const activeCard = $(`card-${activeIdx}`);
    if (activeCard) {
      activeCard.classList.add('active');
      if (state.isAutoScrollEnabled && !state.isUserScrolling) scrollToActive();
    }

    updateLineNav();
    const seg = segments[activeIdx];
    const dur = getDuration();
    elements.timelineSegment.style.left = `${(seg.start / dur) * 100}%`;
    elements.timelineSegment.style.width = `${((seg.end - seg.start) / dur) * 100}%`;
  }

  // Line progress hairline
  if (state.activeSegmentIndex !== -1) {
    const seg = segments[state.activeSegmentIndex];
    const card = $(`card-${state.activeSegmentIndex}`);
    const p = Math.min(1, Math.max(0, (currentTime - seg.start) / (seg.end - seg.start || 1)));
    if (card) card.style.setProperty('--seg-p', p.toFixed(4));
  }
  updateResumeBanner();
}

function syncActiveWord(currentTime) {
  if (state.activeSegmentIndex === -1) return;
  const curSeg = state.currentTrackData.segments[state.activeSegmentIndex];
  if (!curSeg?.words?.length) return;

  const card = $(`card-${state.activeSegmentIndex}`);
  if (!card) return;
  const tokens = card.querySelectorAll('.word-token');

  let newActive = -1;
  curSeg.words.forEach((w, wIdx) => {
    const token = tokens[wIdx];
    if (!token) return;
    if (currentTime >= w.start && currentTime <= w.end) {
      newActive = wIdx;
      const p = (currentTime - w.start) / (w.end - w.start || 1);
      token.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4));
      if (!token.classList.contains('active-word')) {
        token.classList.add('active-word');
        token.classList.remove('spoken');
      }
    } else if (currentTime > w.end) {
      if (!token.classList.contains('spoken')) {
        token.classList.remove('active-word');
        token.classList.add('spoken');
        token.style.removeProperty('--p');
      }
    } else if (token.classList.contains('active-word') || token.classList.contains('spoken')) {
      token.classList.remove('active-word', 'spoken');
      token.style.removeProperty('--p');
    }
  });
  state.activeWordIndex = newActive;
}

function checkSentenceLoop(currentTime) {
  if (!state.isLoopingSentence || state.activeSegmentIndex === -1 || elements.audio.paused) return;
  const curSeg = state.currentTrackData.segments[state.activeSegmentIndex];
  if (curSeg && currentTime >= curSeg.end - 0.15) {
    elements.audio.currentTime = curSeg.start;
  }
}

/**
 * Seek to a timestamp. Card/word clicks start playback (as before);
 * scrubbing passes { play: false } so the play state is preserved.
 */
function seekAudio(timestamp, { play = true } = {}) {
  const t = Math.max(0, Math.min(getDuration(), timestamp));
  elements.audio.currentTime = t;
  if (play && elements.audio.paused) {
    elements.audio.play().catch((err) => console.log('Play interrupted:', err));
  }
  syncActiveSentence(t);
  syncActiveWord(t);
  updateProgressUI(t);
}

function updateProgressUI(forcedTime) {
  const cur = forcedTime ?? (elements.audio.currentTime || 0);
  const dur = getDuration();
  elements.currentTimeDisplay.textContent = formatTime(cur);
  elements.durationTimeDisplay.textContent = formatTime(dur);

  const percent = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  elements.timelineProgress.style.width = `${percent}%`;
  elements.timelineHandle.style.left = `${percent}%`;
  elements.timelineContainer.setAttribute('aria-valuemax', dur.toFixed(1));
  elements.timelineContainer.setAttribute('aria-valuenow', cur.toFixed(1));
  elements.timelineContainer.setAttribute('aria-valuetext', `${formatTime(cur)} of ${formatTime(dur)}`);
}

function updateLineNav() {
  const n = state.currentTrackData?.segments?.length || 0;
  const i = state.activeSegmentIndex;
  elements.lineCounter.textContent = n ? `${i + 1 > 0 ? i + 1 : '–'} / ${n}` : '– / –';
  elements.prevLineBtn.disabled = i <= 0;
  elements.nextLineBtn.disabled = n === 0 || i >= n - 1;
}

/** Jump to the previous / next line. "Previous" restarts the current line if we're >1.5 s into it. */
function jumpLine(dir) {
  const segs = state.currentTrackData?.segments;
  if (!segs?.length) return;
  let i = state.activeSegmentIndex === -1 ? 0 : state.activeSegmentIndex;
  const restartCurrent = dir < 0 && elements.audio.currentTime - segs[i].start > 1.5;
  if (!restartCurrent) i = Math.max(0, Math.min(segs.length - 1, i + dir));
  resumeFollowing();
  seekAudio(segs[i].start + 0.01);
}

// ───────────────────────────── Auto-scroll ─────────────────────────────
function scrollToActive() {
  const card = $(`card-${state.activeSegmentIndex}`);
  if (card) card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
}

/** Where is the live card relative to the reading area? -1 above, 1 below, 0 visible */
function activeCardOffscreen() {
  const card = $(`card-${state.activeSegmentIndex}`);
  if (!card) return 0;
  const r = card.getBoundingClientRect();
  const navH = document.querySelector('.top-nav').offsetHeight;
  const dockTop = document.querySelector('.player-dock').getBoundingClientRect().top;
  if (r.bottom < navH + 12) return -1;
  if (r.top > dockTop - 12) return 1;
  return 0;
}

function updateResumeBanner() {
  const show = state.isAutoScrollEnabled && state.isUserScrolling && state.activeSegmentIndex !== -1;
  const where = show ? activeCardOffscreen() : 0;
  const visible = show && where !== 0;
  elements.resumeScrollBanner.classList.toggle('hidden', !visible);
  elements.resumeScrollBanner.classList.toggle('is-above', where === -1);
  elements.toggleAutoScrollBtn.classList.toggle('suspended', state.isAutoScrollEnabled && state.isUserScrolling);
}

/** Called on genuine user scroll intent (wheel / touch / keys), never on our own smooth scroll. */
function noteUserScroll() {
  if (!state.isAutoScrollEnabled) return;
  state.isUserScrolling = true;
  updateResumeBanner();
  clearTimeout(state.userScrollTimeout);
  state.userScrollTimeout = setTimeout(() => {
    state.isUserScrolling = false;
    updateResumeBanner();
    if (!elements.audio.paused && activeCardOffscreen() !== 0) scrollToActive();
  }, USER_SCROLL_RESUME_MS);
}

function resumeFollowing() {
  clearTimeout(state.userScrollTimeout);
  state.isUserScrolling = false;
  updateResumeBanner();
}

// ───────────────────────────── Toggles ─────────────────────────────
function togglePlayPause() {
  if (elements.audio.paused) {
    elements.audio.play().catch((err) => console.log('Play interrupted:', err));
  } else {
    elements.audio.pause();
  }
}

function updatePlayPauseState(isPlaying) {
  elements.playIcon.classList.toggle('hidden', isPlaying);
  elements.pauseIcon.classList.toggle('hidden', !isPlaying);
  elements.playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  document.body.classList.toggle('is-playing', isPlaying);
}

function setSwitch(btn, on) {
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-checked', String(on));
}

function togglePinyin() {
  state.isPinyinVisible = !state.isPinyinVisible;
  store('belinda_pinyin', state.isPinyinVisible);
  applyPinyinState();
}
function applyPinyinState() {
  document.body.setAttribute('data-pinyin', state.isPinyinVisible ? 'visible' : 'hidden');
  setSwitch(elements.togglePinyinBtn, state.isPinyinVisible);
}

function toggleTones() {
  state.isToneColorOn = !state.isToneColorOn;
  store('belinda_tones', state.isToneColorOn);
  applyToneState();
}
function applyToneState() {
  document.body.setAttribute('data-tones', state.isToneColorOn ? 'on' : 'off');
  setSwitch(elements.toggleTonesBtn, state.isToneColorOn);
}

function toggleAutoScroll() {
  state.isAutoScrollEnabled = !state.isAutoScrollEnabled;
  setSwitch(elements.toggleAutoScrollBtn, state.isAutoScrollEnabled);
  resumeFollowing();
  if (state.isAutoScrollEnabled && state.activeSegmentIndex !== -1) scrollToActive();
}

function toggleLoop() {
  state.isLoopingSentence = !state.isLoopingSentence;
  elements.loopSentenceBtn.classList.toggle('active', state.isLoopingSentence);
  elements.loopSentenceBtn.setAttribute('aria-pressed', String(state.isLoopingSentence));
  document.body.classList.toggle('is-looping', state.isLoopingSentence);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute('content', state.theme === 'dark' ? '#111315' : '#FAF7F2'));
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'zen' : 'dark';
  store('belinda_theme', state.theme);
  applyTheme();
}

function setSidebarOpen(open, { focus = true } = {}) {
  elements.courseSidebar.classList.toggle('closed', !open);
  document.body.classList.toggle('sidebar-open', open);
  elements.toggleSidebarBtn.setAttribute('aria-expanded', String(open));
  if (!isDesktop()) {
    elements.courseSidebar.toggleAttribute('inert', !open);
    if (open && focus) elements.closeSidebarBtn.focus({ preventScroll: true });
  } else {
    elements.courseSidebar.removeAttribute('inert');
  }
}

function setPlaybackSpeed(speed, { persist = true } = {}) {
  state.playbackSpeed = speed;
  elements.audio.playbackRate = speed;
  elements.speedValue.textContent = `${speed}×`;
  elements.speedBtn.classList.toggle('modified', speed !== 1);
  elements.speedMenu.querySelectorAll('button[data-speed]').forEach((b) => {
    const on = parseFloat(b.dataset.speed) === speed;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  if (persist) store('belinda_speed', speed);
}

function setSpeedMenuOpen(open) {
  elements.speedMenu.classList.toggle('hidden', !open);
  elements.speedBtn.setAttribute('aria-expanded', String(open));
  if (open) elements.speedMenu.querySelector('button.active, button[data-speed]')?.focus({ preventScroll: true });
}

// ───────────────────────────── Scrubber ─────────────────────────────
function setupScrubber() {
  const el = elements.timelineContainer;
  const ratioAt = (clientX) => {
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const showTooltip = (ratio) => {
    elements.timelineTooltip.style.left = `${ratio * 100}%`;
    elements.timelineTooltip.textContent = formatTime(ratio * getDuration());
  };

  el.addEventListener('pointermove', (e) => {
    const r = ratioAt(e.clientX);
    showTooltip(r);
    if (state.isScrubbing) {
      const t = r * getDuration();
      updateProgressUI(t);
      seekAudio(t, { play: false });
    }
  });

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    state.isScrubbing = true;
    el.classList.add('dragging');
    const r = ratioAt(e.clientX);
    showTooltip(r);
    resumeFollowing();
    seekAudio(r * getDuration(), { play: false });
  });

  const end = (e) => {
    if (!state.isScrubbing) return;
    state.isScrubbing = false;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  // Keyboard on the focused slider
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); seekAudio(elements.audio.currentTime - step, { play: false }); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); seekAudio(elements.audio.currentTime + step, { play: false }); }
    else if (e.key === 'Home') { e.preventDefault(); seekAudio(0, { play: false }); }
    else if (e.key === 'End') { e.preventDefault(); seekAudio(getDuration() - 0.1, { play: false }); }
  });
}

// ───────────────────────────── Events ─────────────────────────────
function setupEventListeners() {
  const a = elements.audio;
  elements.playPauseBtn.addEventListener('click', togglePlayPause);
  a.addEventListener('play', () => updatePlayPauseState(true));
  a.addEventListener('pause', () => updatePlayPauseState(false));
  a.addEventListener('ended', () => updatePlayPauseState(false));
  a.addEventListener('loadedmetadata', () => { renderTimelineTicks(); updateProgressUI(); });

  elements.skipBackBtn.addEventListener('click', () => seekAudio(a.currentTime - 5));
  elements.skipForwardBtn.addEventListener('click', () => seekAudio(a.currentTime + 5));
  elements.loopSentenceBtn.addEventListener('click', toggleLoop);
  elements.prevLineBtn.addEventListener('click', () => jumpLine(-1));
  elements.nextLineBtn.addEventListener('click', () => jumpLine(1));

  setupScrubber();

  elements.togglePinyinBtn.addEventListener('click', togglePinyin);
  elements.toggleTonesBtn.addEventListener('click', toggleTones);
  elements.toggleAutoScrollBtn.addEventListener('click', toggleAutoScroll);
  elements.toggleThemeBtn.addEventListener('click', toggleTheme);

  elements.toggleSidebarBtn.addEventListener('click', () => {
    setSidebarOpen(elements.courseSidebar.classList.contains('closed'));
  });
  elements.closeSidebarBtn.addEventListener('click', () => setSidebarOpen(false));
  elements.sidebarScrim.addEventListener('click', () => setSidebarOpen(false));

  let wasDesktop = isDesktop();
  window.addEventListener('resize', () => {
    const nowDesktop = isDesktop();
    if (nowDesktop !== wasDesktop) {
      wasDesktop = nowDesktop;
      setSidebarOpen(nowDesktop, { focus: false });
    }
  });

  // Follow system theme changes unless the reader picked one explicitly
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('belinda_theme'); } catch { /* noop */ }
    if (!saved) { state.theme = e.matches ? 'dark' : 'zen'; applyTheme(); }
  });

  // User scroll intent — wheel / touch / keyboard. (A bare `scroll` listener
  // also fires for our own smooth auto-scroll, which would wrongly suspend following.)
  window.addEventListener('wheel', noteUserScroll, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.player-dock, .sidebar')) noteUserScroll();
  }, { passive: true });
  window.addEventListener('scroll', () => { if (state.isUserScrolling) updateResumeBanner(); }, { passive: true });

  elements.resumeScrollBtn.addEventListener('click', () => {
    resumeFollowing();
    scrollToActive();
  });

  // Speed menu
  elements.speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setSpeedMenuOpen(elements.speedMenu.classList.contains('hidden'));
  });
  elements.speedMenu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => setSpeedMenuOpen(false));
  elements.speedMenu.querySelectorAll('button[data-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPlaybackSpeed(parseFloat(btn.dataset.speed));
      setSpeedMenuOpen(false);
      elements.speedBtn.focus({ preventScroll: true });
    });
  });
  elements.speedMenu.addEventListener('keydown', (e) => {
    const items = [...elements.speedMenu.querySelectorAll('button[data-speed]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

    if (e.key === 'Escape') {
      if (!elements.speedMenu.classList.contains('hidden')) { setSpeedMenuOpen(false); elements.speedBtn.focus(); }
      else if (!isDesktop() && !elements.courseSidebar.classList.contains('closed')) setSidebarOpen(false);
      return;
    }
    if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) && !e.target.closest('.dropdown-menu, [role="slider"]')) {
      noteUserScroll();
      return;
    }

    if (e.code === 'Space') {
      // Space is always play/pause (media-player convention); Enter still activates buttons.
      if (e.target.closest('.dropdown-menu')) return;
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (e.shiftKey) jumpLine(-1); else seekAudio(elements.audio.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (e.shiftKey) jumpLine(1); else seekAudio(elements.audio.currentTime + 5);
    } else if (e.key.toLowerCase() === 'p') {
      togglePinyin();
    } else if (e.key.toLowerCase() === 't') {
      toggleTones();
    } else if (e.key.toLowerCase() === 'l') {
      toggleLoop();
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
