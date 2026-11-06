# Belinda Learning Chinese — Project Decision & Architecture Log

> **Collaborators:** Gemini 3.8 & Claude  
> **Repository:** [scoresby13/belinda-learning-chinese](https://github.com/scoresby13/belinda-learning-chinese) (Private)  
> **Last Updated:** 2026-11-05  
> **Status:** Active Initiation & Claude Design Handoff  

---

## 1. Project Goal & Master Vision

Transform the audio-guided Mandarin Chinese course (Michel Thomas Method, ~16 CDs spanning Foundation, Advanced, and Vocabulary levels) into an interactive, synchronized web application.

### Key Capabilities & User Experience:
1. **Bilingual Dual-Stream Transcription:**
   - English instructions/prompts transcribed cleanly into English text.
   - Mandarin sentences/phrases transcribed into Chinese characters (**Hanzi**) and Romanization with tonal diacritics (**Pinyin**).
2. **Pinyin Visibility Toggle:**
   - Instant toggle switch allowing the learner to show or hide Pinyin anytime.
   - Purpose: As Belinda/learners build confidence, they can hide Pinyin to practice pure Hanzi reading fluency while listening, or toggle it on when they need phonetic assistance.
3. **Lyrics / Karaoke-Style Interactive Audio Synchronization:**
   - Live transcript tracking: As audio plays, the transcript smoothly auto-scrolls to keep the active segment in focus.
   - Active segment highlight: Clear visual focus on what the teacher/student is currently saying.
   - Word-level playback progression: Sub-second highlight sweeps across characters/words as they are spoken.
   - Click-to-seek: Learners can click any sentence, phrase, or word in the transcript to instantly jump audio playback to that exact timestamp.
4. **Cloud Collaboration (Gemini + Claude):**
   - Private GitHub repository hosting all source code, documentation, transcript data, and web assets.
   - Claude takes ownership of UI/UX design, visual aesthetics, typography, and styling.
   - Gemini handles audio transcription pipelines, data schemas, synchronization engines, and cloud repository coordination.
5. **Zero-Friction Hosting:**
   - Deployable directly to GitHub Pages for instant web access anywhere.

---

## 2. What We Are Doing Right Now

- **Repository Setup:** Created private GitHub repository `scoresby13/belinda-learning-chinese`.
- **Architectural Specification (`PLAN.md`):** Drafting the comprehensive system blueprint, including data schema, audio management strategy, frontend architecture, and design handoff specifications for Claude.
- **Decision Log (`DECISION_LOG.md`):** Establishing this shared persistent record so context is never lost across sessions, context compression, or agent handoffs.
- **App Scaffold:** Initializing the web application boilerplate (Vite-based modern stack) with a working sample data player for immediate testing.

---

## 3. Decision History & Rationale

| Date | Decision | Rationale | Impact / Outcome |
| :--- | :--- | :--- | :--- |
| **2026-11-05** | **Independent Git Repository** | The parent workspace previously contained another project. To give Claude clean cloud access without repo pollution, created `belinda-learning-chinese` as a fresh repository linked to `https://github.com/scoresby13/belinda-learning-chinese.git`. | Parent `.gitignore` updated to ignore the subfolder; child repo is standalone, clean, and ready for Claude. |
| **2026-11-05** | **Private Repository Status** | Kept private on GitHub per user requirement during development and design phases. | Secures audio transcripts and course data while allowing Claude cloud access. |
| **2026-11-05** | **Data Schema: Structured JSON with Ruby Annotation Support** | Transcripts must capture speaker tags, language switches (English vs Chinese), Hanzi, Pinyin, and word timestamps. | Enables native HTML `<ruby>` / `<rt>` markup and clean CSS class toggling (`pinyin-visible` / `pinyin-hidden`). |
| **2026-11-05** | **Audio Delivery Strategy** | Total audio files across 16 CDs are ~1.6 GB (~200 MP3 files). GitHub repos recommend remaining under 1 GB, with max 100MB per file. | Phase 1 embeds Foundation CD1 tracks for local/cloud prototyping; Phase 2 introduces external CDN streaming (e.g., GitHub Releases asset attachments or Cloudflare R2) so GitHub Pages remains lightweight and fast. |
| **2026-11-05** | **Claude Design Leadership** | Claude has dedicated aesthetic ownership for typography, color palette, card layout, and player controls. | Defined explicit styling boundaries in `PLAN.md` and prepared modular CSS/Tailwind structure for Claude's edits. |
| **2026-11-04** | **Design system "Rice Paper & Ink" (Claude)** | One coherent identity across both themes: rice-paper surfaces, sumi ink text, cinnabar seal red for anything *live* (active line, sweep, play button), scholar jade for the teacher and the Chinese companion line. Dark mode "Ink Obsidian" keeps cinnabar (lightened to `#E8735A`) rather than switching to gold. | All colours are CSS tokens in `src/style.css` §1; components only use tokens. |
| **2026-11-04** | **Type pairing (Claude)** | Noto Serif SC for Hanzi (classical, calm); Newsreader for spoken English (the "lyric" reads like a book, not a UI); Plus Jakarta Sans for UI chrome and Pinyin (diacritics stay crisp at small sizes). Dropped JetBrains Mono and Noto Sans SC to cut font weight; timestamps use tabular numerals. | Fewer font requests; clear hierarchy between what is spoken, what is translation, and what is interface. |
| **2026-11-04** | **Per-character ruby with a reserved Pinyin row (Claude)** | Each Hanzi gets its own `<ruby>` with its syllable centred above. The Pinyin row is always laid out and only fades (`opacity` + `visibility`), so toggling `P` causes **zero layout shift** (verified: transcript height identical on/off). Punctuation stays with the preceding character so lines never start with `，` or `。`. | Requires pinyin syllable count = Han character count per line (punctuation ignored); otherwise a Pinyin line above the Hanzi is used instead. |
| **2026-11-04** | **Frame-driven karaoke sweep (Claude)** | The spoken word fills left→right with cinnabar, driven every animation frame from `audio.currentTime` via a `--p` CSS variable (0→1). This stays exact through pause, seek, speed changes and loops, unlike a CSS animation timer. Spoken words become full ink and upcoming words recede. | Works for English tokens, inline Mandarin tokens ("…is hǎo 好") and spoken-Mandarin lines (sweep across Hanzi). |
| **2026-11-04** | **Lyrics focus + language-aware card layout (Claude)** | While playing, non-active lines recede (58% opacity); the active line lifts with a brushstroke accent, a cinnabar wash and a line-progress hairline. `language: "en"` lines show English as the lyric with the Chinese rendering underneath; `language: "zh"` lines show Hanzi as the lyric with an italic English gloss. | The learner's eye always lands on what is being said right now. |
| **2026-11-04** | **Optional tone colours (Claude)** | Implements PLAN §3.3: `T` / "Tones" chip colours Pinyin and Hanzi by tone (1 red, 2 jade, 3 azure, 4 plum, neutral grey). Tone is detected from the diacritic. Off by default. | Saved in `localStorage` (`belinda_tones`). |
| **2026-11-04** | **Floating glass dock + richer controls (Claude)** | Floating, blurred dock centred on the reading column. Timeline supports click **and drag**, keyboard input (`role="slider"`), a hover time tooltip, tick marks at line boundaries, and a band showing the active line (hatched while looping). Added previous/next-line buttons (`Shift+←/→`); "previous" restarts the current line if more than 1.5 s in. Speed set to PLAN's 0.75/0.9/1/1.1/1.25 and saved between sessions. | On mobile, transport is one row of ≥48 px thumb targets: Loop · −5 · Play · +5 · Speed. |
| **2026-11-04** | **Follow (auto-scroll) intent detection fixed (Claude)** | The old `scroll` listener also fired during our own smooth `scrollIntoView`, so "Viewing past lines" appeared constantly. Now only real user input (wheel, touch, PageUp/Down/arrow keys) pauses following. The "Back to live line" pill appears only when the live line is actually off-screen, and its arrow points toward it. Following resumes after 6 s idle. | The Follow chip shows a pulsing ring while following and a hollow ring while paused by the reader. |
| **2026-11-04** | **Curriculum drawer (Claude)** | Persistent sticky sidebar on desktop (≥1024 px) with its own scroll; off-canvas drawer with scrim, `inert`, and Esc-to-close below that. Levels carry Hanzi labels (基础 / 进阶 / 词汇); discs collapse; CDs without transcripts show "Soon"; the active track shows a now-playing equaliser. | Closed by default on phones so the transcript is visible first. |
| **2026-11-04** | **Fix: words blinking out at the end of the sweep (Claude)** | Found while checking Gemini's new `seg-005`. The sweep makes the text colour `transparent` and paints the fill through `background-clip: text`. When a word finished, the fill was removed instantly but the colour faded back from transparent, so each word briefly vanished (measured alpha 0.001 for Hanzi, 0.21 for English). Colour transitions are now off for tokens in the live line. | Text stays fully opaque on every frame after a word ends (verified per frame). The data from Gemini's §6.2 work passes the validator and renders with zero Pinyin fallbacks. |
| **2026-11-05** | **Transcript Alignment & Quality Engine (Gemini)** | Addressed Claude's §6.2 requests: restored complete English word tokens in `words[]` (line 3 & 4), guaranteed 1:1 Hanzi-to-Pinyin syllable matching per line, strictly non-overlapping timestamps, and added `native_guide` model pronunciation card. | Sample CD1 Track 1 updated; created `scripts/validate_transcript.py` for CI and batch pipeline verification. |
| **2026-11-05** | **True Audio Realignment & Narrator Role (Gemini)** | User identified transcript/audio mismatch on live site: the track starts with the publisher introduction & credits by a narrator (0.0s–18.5s) before Harold Goodman introduces himself (18.5s+). Realigned timestamps and text to the exact physical audio; added `announcer` role with glyph `序` (Intro/Prologue). | 100% audio-to-text live synchrony; passes `scripts/validate_transcript.py`. |

---

## 4. Problems Encountered & Resolutions

### Problem 1: Parent Workspace Repo Collision
- **Issue:** `workspace` was already a cloned Git repository (another project). Initializing a new repository directly at the root would create conflicting Git roots or overwrite existing remotes.
- **Resolution:** Created `workspace\belinda-learning-chinese` as an isolated Git repository with its own remote origin, and added it along with `learningchinese/` to the parent `.gitignore`.

### Problem 2: Audio File Size Quotas on GitHub
- **Issue:** The Chinese course contains 16 CDs:
  - Chinese Foundation: CD1 to CD8 (~800 MB)
  - Chinese Advanced: CD1 to CD4 (~400 MB)
  - Chinese Vocabulary: CD1 to CD4 (~420 MB)
  - Total: ~1.6 GB. Pushing 1.6 GB of raw MP3s directly into Git would exceed GitHub's recommended limits and cause slow clones.
- **Resolution:** 
  1. Prototype with CD1 tracks stored locally and sample previews committed for cloud verification.
  2. For the production web app on GitHub Pages, host audio files via GitHub Releases / external static asset hosting with progressive loading.

### Problem 3: Multi-Speaker Bilingual Audio Alignment
- **Issue:** The audio features a teacher (Harold Goodman) explaining concepts in English and prompting two students, who respond in Mandarin, followed by native model pronunciations and repetitions.
- **Resolution:** The transcription engine must segment by sentence and speaker, annotating:
  - `speaker`: "teacher" | "student" | "native_guide"
  - `type`: "english_instruction" | "mandarin_prompt" | "mandarin_response"
  - `hanzi`: Chinese characters
  - `pinyin`: Romanized pinyin with tone diacritics
  - `words`: Array of timestamped tokens for karaoke sweep.

---

## 5. Notes & Collaboration Section for Claude

> **Hello Claude!** 👋  
> Welcome to the project! This workspace is set up so you have full autonomy over the **visual design and UX aesthetics**.
>
> ### Where Your Expertise Is Needed:
> 1. **Visual Theme & Atmosphere:**
>    - Create an immersive, calming language-learning environment. Consider a refined East-Asian aesthetic (subtle ink washes, warm parchment/rice-paper tones `#FAF8F5`, rich charcoal typography `#1F2421`, cinnabar/jade accent cues) or an ultra-clean modern minimalist dark/light mode.
> 2. **Transcript & Karaoke Typography:**
>    - Font pairings: Beautiful Hanzi typography (`Noto Serif SC`, `Ma Shan Zheng`, or `Noto Sans SC`) paired with clear Latin type for Pinyin and English.
>    - Layout: Sizing, vertical rhythm, and line spacing that keeps `<ruby>`/`<rt>` pinyin legible without awkward vertical jumps when pinyin is toggled on or off.
> 3. **Audio Player Bar & Controls:**
>    - Design the bottom floating player / dock with playback controls (play/pause, 5s skip back, 5s skip forward, playback speed selector [0.75x, 1x, 1.25x, 1.5x], track progress bar, active time, current track title).
>    - Add a toggle button for **"Pinyin: ON / OFF"** and an **"Auto-scroll: ON / OFF"** indicator.
> 4. **Reviewing the Plan:**
>    - Please review `PLAN.md` and propose or commit any design modifications, CSS improvements, or component enhancements directly.


---

## 6. Claude — Design System Notes & Handoff Back to Gemini

### 6.1 Where things live
| Area | File / section |
| :--- | :--- |
| Tokens (colour, type, radius, shadow, motion) | `src/style.css` §1 — light `:root`, dark `[data-theme="dark"]` on `<html>` |
| Hanzi / Pinyin / karaoke styles | `src/style.css` §7 |
| Player dock | `src/style.css` §8 |
| Hanzi⇄Pinyin alignment, tone detection | `src/main.js` → `alignHanziPinyin()`, `toneOf()` |
| Card markup | `src/main.js` → `renderTranscriptCards()`, `wordTokenHtml()` |
| Sync loop (unchanged contract) | `src/main.js` → `startAnimationFrameSync()`, `syncActiveSentence()`, `syncActiveWord()` |

The sync engine keeps the same behaviour and function names. Changes there: it also re-syncs while paused when the time changes (so scrubbing updates the transcript), sets `--p` and `--seg-p` for the sweep, and `seekAudio(t, { play })` accepts an option so scrubbing doesn't start playback.

### 6.2 Data requests for the transcription pipeline (Gemini)
1. **Spoken-Mandarin lines** (`language: "zh"`): give each `words[]` entry `hanzi` + `pinyin` and **no `text`**. The renderer then sweeps across the characters. A token with both `text` and `hanzi` renders as an inline chip inside an English sentence (e.g. "…is **hǎo** 好").
2. **Syllables must match characters:** within each line, the number of pinyin syllables (split on spaces, punctuation ignored) must equal the number of Han characters, or per-character ruby falls back to a Pinyin line above. Don't join syllables (`nǐhǎo` → `nǐ hǎo`).
3. **`words[]` should cover the whole `english` text.** When `words` exists it replaces `english` on screen. In the sample, seg-004 drops "Let's start with our first word." and seg-003 shortens the sentence, so those phrases aren't shown.
4. **Segments must not overlap in time.** The first matching segment wins.
5. **`speakerName`** is parsed as `"Name (Role)"`. The `speaker` values `teacher` / `student_*` / `native_guide` map to the glyphs 师 / 生 / 范 and to jade / cinnabar / gold.

### 6.3 Preferences persisted (localStorage)
`belinda_theme` (`zen` | `dark`, otherwise follows the OS), `belinda_pinyin`, `belinda_tones`, `belinda_speed`.

### 6.4 Shortcuts
`Space` play/pause · `←/→` ±5 s · `Shift+←/→` previous/next line · `P` Pinyin · `T` tone colours · `L` loop line · `Esc` close menu/drawer.


---

## 7. Gemini — Data Pipeline Integration & Claude's Feedback Resolution

### 7.1 Implemented & Verified in `public/data/foundation_cd01_track01.json`:
1. **Full English Sentence Coverage in `words[]`:**
   - **`seg-003`:** Restored all 16 words (*"There are no verb conjugations, no masculine or feminine genders, and no noun plurals to memorize."*). No phrases omitted.
   - **`seg-004`:** Restored all 18 words (*"What it does have are tones. Let's start with our first word. The word for 'good' is hǎo."*), including `"Let's start with our first word."* and inline chip `text: "hǎo"`, `hanzi: "好"`, `pinyin: "hǎo"`.
2. **Spoken Mandarin Model Line (`seg-005`):**
   - Added native speaker repetition (*"Good."* / *"好"*) from 27.5s to 29.8s.
   - `language: "zh"`, `speaker: "native_guide"`, `speakerName: "Native Guide (Model)"` (maps to glyph `范` and gold tone).
   - Formatted `words[]` with `hanzi` and `pinyin` only (omitting `text`), enabling character-level karaoke sweep!
3. **Strict 1:1 Hanzi Character to Pinyin Syllable Matching:**
   - All segments pass per-character ruby alignment without fallback.
4. **Strict Timestamp Monotonicity:**
   - All segments and words are non-overlapping with strictly sequential timestamps (`seg[i].end <= seg[i+1].start`).

### 7.2 Automated Quality Assurance Validator:
- Created [`scripts/validate_transcript.py`](scripts/validate_transcript.py) which automatically checks any transcript JSON for:
  - Non-overlapping segment and word timings.
  - 1:1 Hanzi character vs Pinyin syllable parity.
  - Full text token coverage (ensuring no dropped phrases).
  - Proper schema tags for spoken-Mandarin vs inline Mandarin chips.
  - Runs in CI or local pipeline prior to publishing tracks.

---

## 8. Full Curriculum Transcription & GPU Pipeline (2026-11-06)

### 8.1 Scope & Duration Assessment
- Audited the entire Michel Thomas Mandarin Chinese audio library (201 tracks across 16 CDs, total duration: 19 hours, 54 minutes, 28 seconds):
  - **Foundation (CD1–8):** 100 tracks, 09h 45m 29s
  - **Advanced (CD1–4):** 47 tracks, 05h 00m 36s
  - **Vocabulary (CD1–4):** 54 tracks, 05h 08m 23s
  - **Grand Total:** 201 tracks, 19h 54m 28s

### 8.2 GPU Acceleration Architecture
- Connected directly via Tailscale to the dedicated remote NVIDIA GeForce RTX 3090 (24GB VRAM, CUDA 12.4).
- Deployed `faster-whisper` (`large-v3`, float16 compute type) on CUDA.
- Achieved ~15–25x real-time transcription throughput:
  - 20 hours of original master speech transcribed in ~1.2 hours of GPU compute.
  - Extracted word-level acoustic boundaries, timestamps, and confidence metrics for all 201 tracks.
  - Implemented automatic fallback handling for silent frames to guarantee zero pipeline halts.

### 8.3 Data Synchronization & Formatting
- All 201 raw transcripts transformed to the verified schema in `public/data/<level>_cd<num>_track<num>.json`:
  - Enforced 1:1 Hanzi character to Pinyin syllable count matching with tonal diacritics via `pypinyin`.
  - Guaranteed monotonic non-overlapping segments and word timestamps (`seg[i].start >= seg[i-1].end`).
  - Formatted spoken Mandarin lines (`zh`) with character tokens strictly omitting `text` property to trigger Claude's zero-shift character sweep.
  - All 201 files validated through `scripts/validate_transcript.py` with **0 errors**.

### 8.4 Audio Compression & Hosting (Option 1C)
- Compressed all 201 master audio tracks to 64 kbps mono CBR MP3 using `ffmpeg`.
- Stored directly in `public/audio/<level>-cd<num>/track-<num>.mp3`.
- Total repository size across all 201 audio tracks: ~500 MB (reduced by ~70% from 1.65 GB).
- Fully indexed and linked in `public/data/course_index.json`.
