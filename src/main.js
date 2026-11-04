/**
 * Belinda Learning Chinese — Audio Player & Karaoke Engine
 * Co-developed by Gemini & Claude
 */

// Application State
const state = {
  currentCourse: null,
  currentTrackData: null,
  activeSegmentIndex: -1,
  activeWordIndex: -1,
  isPinyinVisible: true,
  isAutoScrollEnabled: true,
  isUserScrolling: false,
  isLoopingSentence: false,
  userScrollTimeout: null,
  playbackSpeed: 1.0,
  theme: 'zen'
};

// DOM Elements Cache
const elements = {
  app: document.getElementById('app'),
  audio: document.getElementById('nativeAudio'),
  transcriptStream: document.getElementById('transcriptStream'),
  currentTrackHeader: document.getElementById('currentTrackHeader'),
  playingBadge: document.getElementById('playingBadge'),
  playingTitle: document.getElementById('playingTitle'),
  
  // Controls
  playPauseBtn: document.getElementById('playPauseBtn'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),
  skipBackBtn: document.getElementById('skipBackBtn'),
  skipForwardBtn: document.getElementById('skipForwardBtn'),
  loopSentenceBtn: document.getElementById('loopSentenceBtn'),
  
  // Progress & Time
  timelineContainer: document.getElementById('timelineContainer'),
  timelineProgress: document.getElementById('timelineProgress'),
  timelineHandle: document.getElementById('timelineHandle'),
  currentTimeDisplay: document.getElementById('currentTimeDisplay'),
  durationTimeDisplay: document.getElementById('durationTimeDisplay'),
  
  // Toggles & Sidebar
  togglePinyinBtn: document.getElementById('togglePinyinBtn'),
  pinyinStateText: document.getElementById('pinyinStateText'),
  toggleAutoScrollBtn: document.getElementById('toggleAutoScrollBtn'),
  autoScrollStateText: document.getElementById('autoScrollStateText'),
  toggleThemeBtn: document.getElementById('toggleThemeBtn'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  courseSidebar: document.getElementById('courseSidebar'),
  courseTree: document.getElementById('courseTree'),
  resumeScrollBanner: document.getElementById('resumeScrollBanner'),
  resumeScrollBtn: document.getElementById('resumeScrollBtn'),
  
  // Speed Selector
  speedBtn: document.getElementById('speedBtn'),
  speedMenu: document.getElementById('speedMenu')
};

// --- Format Time Seconds to MM:SS ---
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- Initialize App ---
async function initApp() {
  loadStoredPreferences();
  setupEventListeners();
  await loadCourseCatalog();
  await loadTrackData('data/foundation_cd01_track01.json');
  startAnimationFrameSync();
}

// --- Stored Preferences ---
function loadStoredPreferences() {
  const savedPinyin = localStorage.getItem('belinda_pinyin');
  if (savedPinyin !== null) {
    state.isPinyinVisible = savedPinyin === 'true';
    applyPinyinState();
  }

  const savedTheme = localStorage.getItem('belinda_theme');
  if (savedTheme) {
    state.theme = savedTheme;
    document.body.setAttribute('data-theme', state.theme);
  }
}

// --- Load Course Catalog (course_index.json) ---
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

// --- Render Course Sidebar Tree ---
function renderCourseTree(catalog) {
  if (!catalog || !catalog.levels) return;
  
  let html = '';
  catalog.levels.forEach(level => {
    html += `<div class="level-section">
      <div class="level-title">${level.title}</div>`;
    
    level.discs.forEach(disc => {
      html += `<div class="disc-group">
        <div class="disc-title">${disc.title}</div>`;
      
      if (disc.tracks && disc.tracks.length > 0) {
        disc.tracks.forEach(tr => {
          const isActive = tr.id === 'foundation-cd01-01' ? 'active' : '';
          html += `<div class="track-item ${isActive}" data-file="${tr.dataFile}" data-audio="${tr.audioUrl}">
            <span class="track-num">#${tr.track}</span>
            <span class="track-name">${tr.title}</span>
          </div>`;
        });
      } else {
        html += `<div class="track-item disabled" style="opacity: 0.5; font-size: 0.75rem; padding-left: 1.5rem;">Coming soon in batch transcription</div>`;
      }
      
      html += `</div>`;
    });
    
    html += `</div>`;
  });
  
  elements.courseTree.innerHTML = html;
  
  // Track selection click
  elements.courseTree.querySelectorAll('.track-item[data-file]').forEach(item => {
    item.addEventListener('click', () => {
      const file = item.getAttribute('data-file');
      if (file) {
        elements.courseTree.querySelectorAll('.track-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadTrackData(file);
        if (window.innerWidth < 768) {
          elements.courseSidebar.classList.add('closed');
        }
      }
    });
  });
}

// --- Load Individual Track Data ---
async function loadTrackData(jsonPath) {
  try {
    const res = await fetch(jsonPath);
    state.currentTrackData = await res.json();
    
    // Update headers and badges
    elements.currentTrackHeader.textContent = state.currentTrackData.title;
    elements.playingBadge.textContent = state.currentTrackData.course;
    elements.playingTitle.textContent = state.currentTrackData.title;
    
    // Set Audio Source
    elements.audio.src = state.currentTrackData.audioUrl;
    elements.audio.load();
    
    // Render Transcripts
    renderTranscriptCards(state.currentTrackData.segments);
    
    // Reset indices
    state.activeSegmentIndex = -1;
    state.activeWordIndex = -1;
    updateProgressUI();
  } catch (err) {
    console.error('Failed to load track data:', err);
    elements.transcriptStream.innerHTML = `<p class="error-msg">Failed to load transcript data.</p>`;
  }
}

// --- Render Transcript Cards ---
function renderTranscriptCards(segments) {
  if (!segments || segments.length === 0) {
    elements.transcriptStream.innerHTML = `<p class="empty-state">No transcript segments found.</p>`;
    return;
  }
  
  const cardsHtml = segments.map((seg, idx) => {
    const speakerClass = seg.speaker.includes('teacher') ? 'teacher' : 'student';
    const speakerLabel = seg.speakerName || (seg.speaker.includes('teacher') ? 'Harold Goodman (Teacher)' : 'Student');
    
    // Build Mandarin with Ruby markup
    let mandarinContent = '';
    if (seg.hanzi) {
      const hanziChars = Array.from(seg.hanzi);
      const pinyinWords = seg.pinyin ? seg.pinyin.split(' ') : [];
      
      // If matching counts or single words, construct ruby tags
      mandarinContent = `<div class="mandarin-block">`;
      if (pinyinWords.length === hanziChars.length) {
        mandarinContent += hanziChars.map((ch, i) => {
          return `<ruby><rb>${ch}</rb><rt>${pinyinWords[i] || ''}</rt></ruby>`;
        }).join('');
      } else {
        mandarinContent += `<ruby><rb>${seg.hanzi}</rb><rt>${seg.pinyin || ''}</rt></ruby>`;
      }
      mandarinContent += `</div>`;
    }
    
    // Build English gloss with clickable words if available
    let englishContent = `<div class="english-block">`;
    if (seg.words && seg.words.length > 0) {
      englishContent += seg.words.map((w, wIdx) => {
        return `<span class="word-token" data-seg="${idx}" data-word="${wIdx}" data-start="${w.start}" data-end="${w.end}">${w.text || w.hanzi}</span> `;
      }).join('');
    } else {
      englishContent += seg.english;
    }
    englishContent += `</div>`;
    
    return `
      <article class="speech-card" id="card-${idx}" data-index="${idx}" data-start="${seg.start}" data-end="${seg.end}">
        <div class="card-header">
          <span class="speaker-tag ${speakerClass}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            ${speakerLabel}
          </span>
          <span class="time-badge">${formatTime(seg.start)}</span>
        </div>
        <div class="sentence-body">
          ${mandarinContent}
          ${englishContent}
        </div>
      </article>
    `;
  }).join('');
  
  elements.transcriptStream.innerHTML = cardsHtml;
  
  // Click-to-seek on cards
  elements.transcriptStream.querySelectorAll('.speech-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // If user clicked a specific word token with start time
      const wordToken = e.target.closest('.word-token');
      if (wordToken && wordToken.dataset.start) {
        const start = parseFloat(wordToken.dataset.start);
        seekAudio(start);
        return;
      }
      
      const start = parseFloat(card.dataset.start);
      seekAudio(start);
    });
  });
}

// --- Audio Playback Synchronization Engine ---
function startAnimationFrameSync() {
  function loop() {
    if (!elements.audio.paused && state.currentTrackData) {
      const curTime = elements.audio.currentTime;
      syncActiveSentence(curTime);
      syncActiveWord(curTime);
      updateProgressUI();
      checkSentenceLoop(curTime);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// --- Sync Active Sentence ---
function syncActiveSentence(currentTime) {
  if (!state.currentTrackData || !state.currentTrackData.segments) return;
  const segments = state.currentTrackData.segments;
  
  let activeIdx = -1;
  for (let i = 0; i < segments.length; i++) {
    if (currentTime >= segments[i].start && currentTime < segments[i].end) {
      activeIdx = i;
      break;
    }
  }
  
  // If no exact match (e.g. pauses between lines), keep last active or find nearest
  if (activeIdx === -1) {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start) {
        activeIdx = i;
        break;
      }
    }
  }
  
  if (activeIdx !== state.activeSegmentIndex && activeIdx !== -1) {
    // Remove previous active state
    if (state.activeSegmentIndex !== -1) {
      const prevCard = document.getElementById(`card-${state.activeSegmentIndex}`);
      if (prevCard) prevCard.classList.remove('active');
    }
    
    // Set new active card
    state.activeSegmentIndex = activeIdx;
    const activeCard = document.getElementById(`card-${activeIdx}`);
    if (activeCard) {
      activeCard.classList.add('active');
      
      // Auto-scroll if enabled and user not manually scrolling
      if (state.isAutoScrollEnabled && !state.isUserScrolling) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

// --- Sync Active Word Sweep ---
function syncActiveWord(currentTime) {
  if (state.activeSegmentIndex === -1) return;
  const curSeg = state.currentTrackData.segments[state.activeSegmentIndex];
  if (!curSeg || !curSeg.words || curSeg.words.length === 0) return;
  
  const card = document.getElementById(`card-${state.activeSegmentIndex}`);
  if (!card) return;
  
  const tokens = card.querySelectorAll('.word-token');
  curSeg.words.forEach((w, wIdx) => {
    const token = tokens[wIdx];
    if (!token) return;
    
    if (currentTime >= w.start && currentTime <= w.end) {
      token.classList.add('active-word');
      token.classList.remove('spoken');
    } else if (currentTime > w.end) {
      token.classList.remove('active-word');
      token.classList.add('spoken');
    } else {
      token.classList.remove('active-word', 'spoken');
    }
  });
}

// --- Check Sentence Loop ---
function checkSentenceLoop(currentTime) {
  if (!state.isLoopingSentence || state.activeSegmentIndex === -1) return;
  const curSeg = state.currentTrackData.segments[state.activeSegmentIndex];
  if (curSeg && currentTime >= curSeg.end - 0.15) {
    seekAudio(curSeg.start);
  }
}

// --- Seek Audio ---
function seekAudio(timestamp) {
  elements.audio.currentTime = timestamp;
  if (elements.audio.paused) {
    elements.audio.play();
    updatePlayPauseState(true);
  }
  syncActiveSentence(timestamp);
  updateProgressUI();
}

// --- Update Progress Bar and Timers ---
function updateProgressUI() {
  const cur = elements.audio.currentTime || 0;
  const dur = elements.audio.duration || state.currentTrackData?.durationSeconds || 30;
  
  elements.currentTimeDisplay.textContent = formatTime(cur);
  elements.durationTimeDisplay.textContent = formatTime(dur);
  
  const percent = dur > 0 ? (cur / dur) * 100 : 0;
  elements.timelineProgress.style.width = `${percent}%`;
  elements.timelineHandle.style.left = `${percent}%`;
}

// --- Toggle Play / Pause ---
function togglePlayPause() {
  if (elements.audio.paused) {
    elements.audio.play().then(() => {
      updatePlayPauseState(true);
    }).catch(err => console.log("Play interrupted:", err));
  } else {
    elements.audio.pause();
    updatePlayPauseState(false);
  }
}

function updatePlayPauseState(isPlaying) {
  if (isPlaying) {
    elements.playIcon.classList.add('hidden');
    elements.pauseIcon.classList.remove('hidden');
    elements.playPauseBtn.setAttribute('aria-label', 'Pause');
  } else {
    elements.playIcon.classList.remove('hidden');
    elements.pauseIcon.classList.add('hidden');
    elements.playPauseBtn.setAttribute('aria-label', 'Play');
  }
}

// --- Toggle Pinyin Visibility ---
function togglePinyin() {
  state.isPinyinVisible = !state.isPinyinVisible;
  localStorage.setItem('belinda_pinyin', state.isPinyinVisible);
  applyPinyinState();
}

function applyPinyinState() {
  document.body.setAttribute('data-pinyin', state.isPinyinVisible ? 'visible' : 'hidden');
  elements.togglePinyinBtn.classList.toggle('active', state.isPinyinVisible);
  elements.togglePinyinBtn.setAttribute('aria-checked', state.isPinyinVisible);
  elements.pinyinStateText.textContent = state.isPinyinVisible ? 'ON' : 'OFF';
}

// --- Toggle Auto-scroll ---
function toggleAutoScroll() {
  state.isAutoScrollEnabled = !state.isAutoScrollEnabled;
  elements.toggleAutoScrollBtn.classList.toggle('active', state.isAutoScrollEnabled);
  elements.toggleAutoScrollBtn.setAttribute('aria-checked', state.isAutoScrollEnabled);
  elements.autoScrollStateText.textContent = state.isAutoScrollEnabled ? 'ON' : 'OFF';
  
  if (state.isAutoScrollEnabled && state.activeSegmentIndex !== -1) {
    const card = document.getElementById(`card-${state.activeSegmentIndex}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    elements.resumeScrollBanner.classList.add('hidden');
  }
}

// --- Toggle Theme (Zen / Dark) ---
function toggleTheme() {
  state.theme = state.theme === 'zen' ? 'dark' : 'zen';
  document.body.setAttribute('data-theme', state.theme);
  localStorage.setItem('belinda_theme', state.theme);
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  // Play / Pause
  elements.playPauseBtn.addEventListener('click', togglePlayPause);
  elements.audio.addEventListener('play', () => updatePlayPauseState(true));
  elements.audio.addEventListener('pause', () => updatePlayPauseState(false));
  elements.audio.addEventListener('ended', () => updatePlayPauseState(false));
  
  // Skip buttons
  elements.skipBackBtn.addEventListener('click', () => {
    seekAudio(Math.max(0, elements.audio.currentTime - 5));
  });
  elements.skipForwardBtn.addEventListener('click', () => {
    seekAudio(Math.min(elements.audio.duration || 9999, elements.audio.currentTime + 5));
  });
  
  // Sentence Loop
  elements.loopSentenceBtn.addEventListener('click', () => {
    state.isLoopingSentence = !state.isLoopingSentence;
    elements.loopSentenceBtn.classList.toggle('active', state.isLoopingSentence);
  });
  
  // Scrubber scrubbing
  elements.timelineContainer.addEventListener('click', (e) => {
    const rect = elements.timelineContainer.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const duration = elements.audio.duration || state.currentTrackData?.durationSeconds || 30;
    seekAudio(clickRatio * duration);
  });
  
  // Pinyin & Auto-scroll Toggles
  elements.togglePinyinBtn.addEventListener('click', togglePinyin);
  elements.toggleAutoScrollBtn.addEventListener('click', toggleAutoScroll);
  elements.toggleThemeBtn.addEventListener('click', toggleTheme);
  
  // Sidebar Toggles
  elements.toggleSidebarBtn.addEventListener('click', () => {
    elements.courseSidebar.classList.toggle('closed');
  });
  elements.closeSidebarBtn.addEventListener('click', () => {
    elements.courseSidebar.classList.add('closed');
  });
  
  // User Scroll Detection
  window.addEventListener('scroll', () => {
    if (!state.isAutoScrollEnabled) return;
    
    // User is manually scrolling
    state.isUserScrolling = true;
    elements.resumeScrollBanner.classList.remove('hidden');
    
    clearTimeout(state.userScrollTimeout);
    state.userScrollTimeout = setTimeout(() => {
      state.isUserScrolling = false;
    }, 5000); // Resume auto-scroll after 5s of no scroll activity
  }, { passive: true });
  
  elements.resumeScrollBtn.addEventListener('click', () => {
    state.isUserScrolling = false;
    elements.resumeScrollBanner.classList.add('hidden');
    if (state.activeSegmentIndex !== -1) {
      const card = document.getElementById(`card-${state.activeSegmentIndex}`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  
  // Speed Selector
  elements.speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.speedMenu.classList.toggle('hidden');
  });
  
  document.addEventListener('click', () => {
    elements.speedMenu.classList.add('hidden');
  });
  
  elements.speedMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      state.playbackSpeed = speed;
      elements.audio.playbackRate = speed;
      elements.speedBtn.textContent = `${speed}x`;
      elements.speedMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      elements.speedMenu.classList.add('hidden');
    });
  });
  
  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seekAudio(Math.max(0, elements.audio.currentTime - 5));
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      seekAudio(Math.min(elements.audio.duration || 9999, elements.audio.currentTime + 5));
    } else if (e.key.toLowerCase() === 'p') {
      togglePinyin();
    } else if (e.key.toLowerCase() === 'l') {
      elements.loopSentenceBtn.click();
    }
  });
}

// Start app on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
