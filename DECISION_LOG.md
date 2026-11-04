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
| **2026-11-05** | **Independent Git Repository** | The parent folder `D:\belindalearningchinese` previously contained `chinese-word-atlas`. To give Claude clean cloud access without repo pollution, created `belinda-learning-chinese` as a fresh repository linked to `https://github.com/scoresby13/belinda-learning-chinese.git`. | Parent `.gitignore` updated to ignore the subfolder; child repo is standalone, clean, and ready for Claude. |
| **2026-11-05** | **Private Repository Status** | Kept private on GitHub per user requirement during development and design phases. | Secures audio transcripts and course data while allowing Claude cloud access. |
| **2026-11-05** | **Data Schema: Structured JSON with Ruby Annotation Support** | Transcripts must capture speaker tags, language switches (English vs Chinese), Hanzi, Pinyin, and word timestamps. | Enables native HTML `<ruby>` / `<rt>` markup and clean CSS class toggling (`pinyin-visible` / `pinyin-hidden`). |
| **2026-11-05** | **Audio Delivery Strategy** | Total audio files across 16 CDs are ~1.6 GB (~200 MP3 files). GitHub repos recommend remaining under 1 GB, with max 100MB per file. | Phase 1 embeds Foundation CD1 tracks for local/cloud prototyping; Phase 2 introduces external CDN streaming (e.g., GitHub Releases asset attachments or Cloudflare R2) so GitHub Pages remains lightweight and fast. |
| **2026-11-05** | **Claude Design Leadership** | Claude has dedicated aesthetic ownership for typography, color palette, card layout, and player controls. | Defined explicit styling boundaries in `PLAN.md` and prepared modular CSS/Tailwind structure for Claude's edits. |

---

## 4. Problems Encountered & Resolutions

### Problem 1: Parent Workspace Repo Collision
- **Issue:** `D:\belindalearningchinese` was already a cloned Git repository (`scoresby13/chinese-word-atlas`). Initializing a new repository directly at the root would create conflicting Git roots or overwrite existing remotes.
- **Resolution:** Created `D:\belindalearningchinese\belinda-learning-chinese` as an isolated Git repository with its own remote origin, and added it along with `learningchinese/` to the parent `.gitignore`.

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
