# Learning Chinese 🇨🇳 🎧

An interactive, lyrics-synchronized web application for learning Mandarin Chinese using the audio-guided method (Michel Thomas Mandarin Chinese Course).

Built with **Gemini** (transcription pipeline, data schema & sync engine) and **Claude** (UI/UX design, visual aesthetics & styling).

[![GitHub Pages Deployment](https://img.shields.io/badge/Deployment-GitHub%20Pages-blue.svg)](https://scoresby13.github.io/learning-chinese/)
[![Repo Status](https://img.shields.io/badge/Status-Active%20Development-green.svg)]()
[![Design Lead](https://img.shields.io/badge/Design%20Lead-Claude-purple.svg)]()

---

## ✨ Features

- 🎵 **Lyrics-Style Live Audio Synchronization:** The transcript automatically scrolls and highlights the active spoken sentence as the lesson plays.
- 🔤 **Toggleable Pinyin:** Instantly switch Pinyin on or off. Beginners can read Pinyin + Hanzi side-by-side, while intermediate learners can hide Pinyin to test and master their Hanzi reading skills.
- 🎯 **Click-to-Seek Navigation:** Click any line, phrase, or word in the transcript to instantly jump playback to that timestamp.
- ⚡ **Word-by-Word Sweeping Progress:** Visual progress sweeps across characters as they are pronounced.
- 🎨 **Tone Colours:** Optionally colour Pinyin and Hanzi by tone (1st red · 2nd jade · 3rd azure · 4th plum · neutral grey) to build tone memory.
- ⌨️ **Keyboard Shortcuts:** `Space` play/pause · `←/→` ±5 s · `Shift+←/→` previous/next line · `P` Pinyin · `T` tones · `L` loop line.
- 🔁 **Sentence Loop & Speed Controls:** Slow down speech (0.75x, 0.9x) or loop difficult phrases to perfect tones and pronunciation.
- 📱 **Responsive & Clean UI:** Designed by Claude with a refined, distraction-free aesthetic optimized for desktop and mobile reading.
- 🚀 **GitHub Pages Ready:** Zero-backend static web application deployable directly on GitHub Pages.

---

## 📚 Course Curriculum (16 CDs)

1. **Chinese Foundation (CD 1 – 8):** Core grammar structures, tone mechanics, basic questions, negatives, and high-frequency verbs.
2. **Chinese Advanced (CD 1 – 4):** Complex sentences, connectors, fluent transitions, and conversational nuances.
3. **Chinese Vocabulary (CD 1 – 4):** Vocabulary expansion across essential daily scenarios.

---

## 🛠️ Tech Stack

- **Build Engine:** [Vite](https://vitejs.dev/)
- **Frontend:** Modern Vanilla / TypeScript & HTML5 Web Audio API
- **Transcription Pipeline:** Gemini 3.5 Multimodal Audio Transcriber
- **Deployment:** GitHub Pages (Static bundle via GitHub Actions)

---

## 🤝 Gemini & Claude Collaboration

This project is co-developed between **Gemini** and **Claude**:
- **Gemini:** Manages repository infrastructure, audio dataset processing, transcription pipeline, timestamp alignment, and GitHub synchronization.
- **Claude:** Leads the visual aesthetics, design system, typography, color palette, responsive UI layouts, and audio player micro-interactions.

### Important Shared Documents:
- 📋 [**PLAN.md**](./PLAN.md) — Detailed technical architecture, JSON schemas, and milestone roadmap.
- 📝 [**DECISION_LOG.md**](./DECISION_LOG.md) — Persistent record of goals, technical decisions, blockers, and handoff notes for Claude.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Quick Start
```bash
# Clone the repository
git clone https://github.com/scoresby13/learning-chinese.git
cd learning-chinese

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open your browser at `http://localhost:5173` to view the interactive player.

### Build for Production (GitHub Pages)
```bash
npm run build
```
The optimized static output is generated in `dist/`.

---

## 📄 License
Educational and personal learning purposes.
