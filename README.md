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
- 👀 **Pinyin Peek:** With Pinyin hidden, tap (or hover over) any character to see its syllable for a moment.
- 🗣️ **Your Turn Pauses:** Optionally pause after the teacher asks you to say something, with the answer hidden until you've tried.
- 🔁 **Loop, Repeat Aloud & Speed:** Loop a line, or loop it with a pause long enough to say it yourself; slow speech to 0.75× or 0.9×.
- ⭐ **Saved Lines:** Star difficult lines and come back to them from the course menu.
- 🔒 **Lock-Screen Controls & Resume:** Play/pause, ±5 s and previous/next line from the lock screen or headphones; reopens where you left off.
- 📴 **Works Offline:** Installable as an app; lessons you've opened (including audio) keep working without signal.
- ⌨️ **Keyboard Shortcuts:** `Space` play/pause · `←/→` ±5 s · `Shift+←/→` previous/next line · `P` Pinyin · `T` tones · `L` loop / repeat aloud · `S` save line.
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

### Run the tests
```bash
npm test
```
Builds the site and runs the Playwright browser tests (desktop and phone). The first time, install Chromium with `npx playwright install chromium`. CI runs these plus the transcript validator on every push.

### Build for Production (GitHub Pages)
```bash
npm run build
```
The optimized static output is generated in `dist/`.

---

## 📱 Android App

There are two ways to get it on an Android phone:

1. **Install the web app (no download):** open the site in Chrome, then tap **⋮ → Add to home screen / Install app**. It runs full-screen, works offline and has lock-screen controls.
2. **Install the APK:** every push to `main` builds `learning-chinese.apk` and attaches it to the **android-latest** release (Releases → *Android app — latest build*). Download it on the phone, open it, and allow "Install unknown apps" when asked. Builds from other branches are under **Actions → Android app → Artifacts**.

The native app is a [Capacitor](https://capacitorjs.com/) shell around the same web code (`android/`), with [`@capgo/capacitor-media-session`](https://github.com/Cap-go/capacitor-media-session) for lock-screen controls and background playback.

**Build it yourself** (needs Android Studio / the Android SDK and JDK 21):
```bash
npm run build && npx cap sync android
```
```bash
cd android && ./gradlew assembleDebug
```

**Signing for updates and Google Play.** Without signing secrets, CI builds a debug-signed APK, and each build gets a new debug key, so installing a newer build means uninstalling the old one first. To sign every build with the same key, create one once:
```bash
keytool -genkeypair -v -keystore release.jks -alias learning-chinese -keyalg RSA -keysize 2048 -validity 10000
```
Then add these repository secrets (Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (output of `base64 -w0 release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`learning-chinese`) and `ANDROID_KEY_PASSWORD`. Keep `release.jks` safe and out of the repository: losing it means users can't update the app.

---

## 📄 License
Private repository for educational and personal learning purposes.
