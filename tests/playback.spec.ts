import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type Harness = {
  loads: string[]
  state: number
  outcome: 'play' | 'block' | number
  emitState: (state: number) => void
  lateEnded: () => void
}

declare global {
  interface Window { __youtubeTest: Harness }
}

// Simulate only the API surface used by the app. No live YouTube dependencies.
const mockApi = String.raw`
(() => {
  class Player {
    constructor(target, options) {
      this.events = options.events;
      this.loads = [];
      this.id = '';
      this.state = -1;
      this.outcome = 'play';
      this.iframe = document.createElement('iframe');
      this.iframe.src = 'about:blank';
      target.replaceWith(this.iframe);
      window.__youtubeTest = this;
      setTimeout(() => this.events.onReady({target: this}), 0);
    }
    getIframe() { return this.iframe; }
    getVideoUrl() { return this.id ? 'https://www.youtube.com/watch?v=' + this.id : ''; }
    getPlayerState() { return this.state; }
    emitState(state) {
      this.state = state;
      this.events.onStateChange({target: this, data: state});
    }
    lateEnded() { this.events.onStateChange({target: this, data: 0}); }
    loadVideoById(id) {
      this.id = id;
      this.loads.push(id);
      this.emitState(-1);
      setTimeout(() => { if (this.id === id) this.playVideo(); }, 0);
    }
    playVideo() {
      const outcome = this.outcome;
      this.outcome = 'play';
      if (outcome === 'block') this.events.onAutoplayBlocked({target: this});
      else if (typeof outcome === 'number') this.events.onError({target: this, data: outcome});
      else this.emitState(1);
    }
    pauseVideo() { this.emitState(2); }
    stopVideo() { this.emitState(0); }
    destroy() { this.iframe.remove(); }
  }
  window.YT = {Player, PlayerState: {UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5}};
  window.onYouTubeIframeAPIReady();
})();
`

const firstId = 'M7lc1UVf-VE'
const secondId = 'bHQqvYy5KYo'

async function fillLinks(page: Page) {
  await page.getByLabel('Video 1', { exact: true }).fill(`https://www.youtube.com/watch?v=${firstId}&t=15`)
  await page.getByLabel('Video 2', { exact: true }).fill(`https://youtu.be/${secondId}`)
}

test.beforeEach(async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: mockApi }))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start test' })).toBeEnabled()
})

test('requires exact YouTube links and rejects lookalike domains and playlist-only links', async ({ page }) => {
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(2)
  await page.getByLabel('Video 1', { exact: true }).fill(`https://www.youtube.com.evil.example/watch?v=${firstId}`)
  await page.getByLabel('Video 2', { exact: true }).fill('https://www.youtube.com/playlist?list=example')
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(2)
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([])
  await fillLinks(page)
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([firstId])
})

test('advances once on end, ignores late end events, and stops after video two', async ({ page }) => {
  await fillLinks(page)
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.__youtubeTest.emitState(0)
    window.__youtubeTest.lateEnded()
  })
  await expect(page.getByRole('status')).toContainText('Video 2 of 2')
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  await page.evaluate(() => window.__youtubeTest.lateEnded())
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([firstId, secondId])
  await page.evaluate(() => window.__youtubeTest.emitState(0))
  await expect(page.getByRole('heading', { name: 'Test complete' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip video' })).toBeDisabled()
  await expect(page.getByLabel('Video 1', { exact: true })).toBeEnabled()
})

test('supports app and native pause/resume, skip, reset, and a fresh session', async ({ page }) => {
  await fillLinks(page)
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Paused', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  await page.evaluate(() => window.__youtubeTest.emitState(2))
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.getByRole('button', { name: 'Skip video' }).click()
  await expect(page.getByRole('status')).toContainText('Video 2 of 2')
  await page.getByRole('button', { name: 'Skip video' }).click()
  await expect(page.getByRole('heading', { name: 'Test complete' })).toBeVisible()
  expect(await page.evaluate(() => window.__youtubeTest.state)).toBe(2)
  await page.getByRole('button', { name: 'Reset test' }).click()
  await page.evaluate(() => window.__youtubeTest.emitState(0))
  await expect(page.getByRole('heading', { name: 'Ready for a test' })).toBeVisible()
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('status')).toContainText('Video 1 of 2')
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
})

test('recovers from blocked playback on either video without advancing the selection', async ({ page }) => {
  await fillLinks(page)
  await page.evaluate(() => { window.__youtubeTest.outcome = 'block' })
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('alert')).toContainText('Your browser blocked playback')
  await expect(page.getByRole('status')).toContainText('Video 1 of 2')
  await page.getByRole('button', { name: 'Resume playback' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  await page.evaluate(() => {
    window.__youtubeTest.outcome = 'block'
    window.__youtubeTest.emitState(0)
  })
  await expect(page.getByRole('status')).toContainText('Video 2 of 2')
  await expect(page.getByRole('button', { name: 'Resume playback' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume playback' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([firstId, secondId])
})

test('keeps a rejected embed selected and allows retry', async ({ page }) => {
  await fillLinks(page)
  await page.evaluate(() => { window.__youtubeTest.outcome = 101 })
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('alert')).toContainText('does not allow embedded playback')
  await expect(page.getByRole('status')).toContainText('Video 1 of 2')
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([firstId])
  await page.getByRole('button', { name: 'Retry video' }).click()
  await expect(page.getByRole('heading', { name: 'Playing', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__youtubeTest.loads)).toEqual([firstId, firstId])
})

test('allows skipping failed videos through the end of the sequence', async ({ page }) => {
  await fillLinks(page)
  await page.evaluate(() => { window.__youtubeTest.outcome = 150 })
  await page.getByRole('button', { name: 'Start test' }).click()
  await expect(page.getByRole('alert')).toContainText('does not allow embedded playback')
  await page.evaluate(() => { window.__youtubeTest.outcome = 100 })
  await page.getByRole('button', { name: 'Skip video' }).click()
  await expect(page.getByRole('alert')).toContainText('This video is unavailable')
  await expect(page.getByRole('status')).toContainText('Video 2 of 2')
  await page.getByRole('button', { name: 'Skip video' }).click()
  await expect(page.getByRole('heading', { name: 'Test complete' })).toBeVisible()
})

test('keeps the player and controls usable on a phone and with larger text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
    player: document.querySelector('iframe')!.getBoundingClientRect().toJSON(),
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.player.width).toBeGreaterThanOrEqual(200)
  expect(dimensions.player.height).toBeGreaterThanOrEqual(200)
  await expect(page.getByLabel('Video 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible()
})

test('reports an API loading failure and offers reload', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.abort())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Player unavailable' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('YouTube could not load')
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start test' })).toBeDisabled()
})
