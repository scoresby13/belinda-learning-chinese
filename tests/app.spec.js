import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const TRACK = JSON.parse(fs.readFileSync(new URL('../public/data/foundation_cd01_track01.json', import.meta.url)));

/** Serve a modified copy of the sample lesson (test-only fixture). */
async function withLesson(page, mutate) {
  const data = structuredClone(TRACK);
  mutate(data);
  await page.route('**/foundation_cd01_track01.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
}

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.locator('.speech-card').first()).toBeVisible();
  await page.evaluate(() => { document.getElementById('nativeAudio').muted = true; });
  return errors;
}

const audio = (page, fn) => page.evaluate(fn);
const playFrom = (page, t) => page.evaluate(async (t) => {
  const a = document.getElementById('nativeAudio');
  a.currentTime = t;
  await a.play();
}, t);
const currentTime = (page) => page.evaluate(() => document.getElementById('nativeAudio').currentTime);

test('renders every line with per-character Pinyin and no errors', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('.speech-card')).toHaveCount(TRACK.segments.length);
  await expect(page.locator('.pinyin-line')).toHaveCount(0); // no fallback rendering
  expect(await page.locator('ruby.glyph:not(.punct)').count()).toBeGreaterThan(50);
  await expect(page).toHaveTitle(/Learning Chinese/);
  expect(errors).toEqual([]);
});

test('toggling Pinyin causes no layout shift', async ({ page }) => {
  await open(page);
  const h = () => page.locator('#transcriptStream').evaluate((el) => el.getBoundingClientRect().height);
  const before = await h();
  await page.keyboard.press('p');
  await expect(page.locator('body')).toHaveAttribute('data-pinyin', 'hidden');
  expect(await h()).toBe(before);
});

test('karaoke words never blink out when their sweep ends', async ({ page }) => {
  await open(page);
  // English word "Welcome" ends at 0.9 s; Hanzi 好 in seg-005 ends at 29.2 s
  for (const [start, end, sel] of [[0.6, 0.9, '#card-0 .word-token'], [28.9, 29.2, '#card-4 .word-token .glyph-han']]) {
    const minAlpha = await page.evaluate(async ({ start, end, sel }) => {
      const a = document.getElementById('nativeAudio');
      a.currentTime = start; await a.play();
      const alpha = (c) => { const m = c.match(/\/\s*([\d.]+)\)|rgba\([^)]*,\s*([\d.]+)\)/); return m ? parseFloat(m[1] ?? m[2]) : 1; };
      let min = 1;
      await new Promise((done) => {
        const tick = () => {
          if (a.currentTime > end + 0.02) {
            const cs = getComputedStyle(document.querySelector(sel));
            if (!(cs.backgroundClip === 'text' && cs.backgroundImage !== 'none')) min = Math.min(min, alpha(cs.color));
          }
          if (a.currentTime > end + 0.35 || a.ended) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      a.pause();
      return min;
    }, { start, end, sel });
    expect(minAlpha).toBe(1);
  }
});

test('auto-scroll does not raise the resume pill; scrolling away does', async ({ page }) => {
  await open(page);
  await playFrom(page, 0.2);
  await page.waitForTimeout(400);
  await audio(page, () => { document.getElementById('nativeAudio').currentTime = 27.6; });
  await page.waitForTimeout(1200); // smooth auto-scroll to the last line
  await expect(page.locator('#resumeScrollBanner')).toBeHidden();
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -3000);
  await expect(page.locator('#resumeScrollBanner')).toBeVisible();
  await page.click('#resumeScrollBtn');
  await expect(page.locator('#resumeScrollBanner')).toBeHidden();
});

test('resumes the last lesson at the saved position', async ({ page }) => {
  await open(page);
  await playFrom(page, 12.5);
  await page.waitForTimeout(300);
  await audio(page, () => document.getElementById('nativeAudio').pause());
  await page.reload();
  await expect(page.locator('#toast')).toContainText('Picked up where you left off');
  await expect.poll(() => currentTime(page)).toBeGreaterThan(12);
  await page.click('#toastAction'); // Start over
  await expect.poll(() => currentTime(page)).toBeLessThan(0.5);
});

test('saving a line lists it in the sidebar and survives a reload', async ({ page }) => {
  await open(page);
  await page.locator('#card-1').hover();
  await page.locator('#card-1 .save-btn').click();
  await expect(page.locator('#card-1 .save-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.saved-item')).toHaveCount(1);
  await expect(page.locator('#card-1 .save-btn')).toHaveClass(/saved/);
  await page.locator('.saved-open').click();
  await expect.poll(() => currentTime(page)).toBeGreaterThan(TRACK.segments[1].start);
});

test('Your turn pauses after a prompt and hides the answer until play', async ({ page }) => {
  await withLesson(page, (d) => { d.segments[3].type = 'prompt'; }); // seg-004 → prompt, seg-005 is its answer
  await open(page);
  await page.click('#settingsBtn');
  await page.click('[data-setting="yourTurn"]');
  await page.keyboard.press('Escape');
  const answer = page.locator('#card-4');
  await expect(answer).toHaveClass(/is-answer/);
  await expect(answer.locator('.reveal-btn')).toBeVisible();

  await playFrom(page, TRACK.segments[3].end - 0.8);
  await expect(answer).toHaveClass(/awaiting/, { timeout: 3000 });
  expect(await audio(page, () => document.getElementById('nativeAudio').paused)).toBe(true);
  await expect(answer.locator('.reveal-btn')).toBeVisible();

  await page.keyboard.press('Space'); // reveal + continue
  await expect(answer).toHaveClass(/revealed/);
  await expect(answer.locator('.reveal-btn')).toBeHidden();
  expect(await audio(page, () => document.getElementById('nativeAudio').paused)).toBe(false);
});

test('Repeat aloud pauses after the line, then replays it', async ({ page }) => {
  await open(page);
  await page.keyboard.press('l'); // loop
  await page.keyboard.press('l'); // repeat aloud
  await expect(page.locator('#loopSentenceBtn')).toHaveAttribute('data-mode', 'shadow');
  const seg = TRACK.segments[0];
  await playFrom(page, seg.end - 0.5);
  await expect(page.locator('body')).toHaveClass(/shadow-gap/, { timeout: 3000 });
  expect(await audio(page, () => document.getElementById('nativeAudio').paused)).toBe(true);
  await expect(page.locator('body')).not.toHaveClass(/shadow-gap/, { timeout: 12_000 });
  const t = await currentTime(page);
  expect(t).toBeGreaterThanOrEqual(seg.start);
  expect(t).toBeLessThan(seg.start + 1.5);
  expect(await audio(page, () => document.getElementById('nativeAudio').paused)).toBe(false);
});

test('with Pinyin hidden, tapping a character peeks without seeking', async ({ page }) => {
  await open(page);
  await page.keyboard.press('p');
  const glyph = page.locator('#card-2 ruby.glyph:not(.punct)').first();
  const rt = glyph.locator('rt');
  await expect(rt).toHaveCSS('opacity', '0');
  await glyph.click();
  await expect(rt).toHaveCSS('opacity', '1');
  expect(await currentTime(page)).toBeLessThan(1);
});

test('settings panel hides the English meaning and keeps the choice', async ({ page }) => {
  await withLesson(page, () => {});
  await open(page);
  await expect(page.locator('#card-4 .gloss-en')).toBeVisible();
  await page.click('#settingsBtn');
  await page.click('[data-setting="glossEn"]');
  await expect(page.locator('#card-4 .gloss-en')).toBeHidden();
  await page.reload();
  await expect(page.locator('#card-4 .gloss-en')).toBeHidden();
});

test('installable web app: manifest, icons and service worker', async ({ page }) => {
  await open(page);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(manifestHref)).json();
  expect(manifest.name).toBe('Learning Chinese');
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), { timeout: 10_000 }).toBe(true);
});

test('@mobile phone layout: no sideways scroll, drawer opens and closes', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#courseSidebar')).toHaveClass(/closed/);
  await page.click('#toggleSidebarBtn');
  await expect(page.locator('#courseSidebar')).not.toHaveClass(/closed/);
  await page.click('#closeSidebarBtn');
  await expect(page.locator('#courseSidebar')).toHaveClass(/closed/);
  for (const id of ['#playPauseBtn', '#skipBackBtn', '#skipForwardBtn', '#loopSentenceBtn', '#speedBtn']) {
    const box = await page.locator(id).boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44); // thumb-sized targets
  }
});

test('lock-screen controls get the lesson title and playback state', async ({ page }) => {
  await open(page);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('Introduction to Mandarin & Tones');
  expect(await page.evaluate(() => navigator.mediaSession.metadata.artist)).toBe('Learning Chinese');
  await playFrom(page, 1);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing');
  await audio(page, () => document.getElementById('nativeAudio').pause());
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('paused');
});

test('works offline after the first visit, including lesson audio', async ({ page, context }) => {
  await open(page);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('lc-audio-v1')).keys()).length), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.reload(); // let the active worker take control and cache the page itself
  await expect(page.locator('.speech-card').first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.speech-card')).toHaveCount(TRACK.segments.length);
  // Audio plays from the cache via Range requests, including after a seek
  await page.evaluate(() => { document.getElementById('nativeAudio').muted = true; });
  await playFrom(page, 20);
  await expect.poll(() => currentTime(page), { timeout: 5000 }).toBeGreaterThan(20.3);
  await context.setOffline(false);
});
