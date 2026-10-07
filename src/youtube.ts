declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
}

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/

export function videoIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null

    let id: string | null = null
    if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) {
      id = url.pathname.match(/^\/([^/]+)\/?$/)?.[1] ?? null
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v')
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1] ?? null
    } else if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1] ?? null
    }

    return id && videoIdPattern.test(id) ? id : null
  } catch {
    return null
  }
}

let apiPromise: Promise<void> | null = null

export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const previousCallback = window.onYouTubeIframeAPIReady
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.onerror = null
      window.onYouTubeIframeAPIReady = previousCallback
    }
    const fail = () => {
      cleanup()
      script.remove()
      reject(new Error('YouTube could not load. Check your connection or content blocker, then reload this page.'))
    }
    const timeout = window.setTimeout(fail, 15_000)

    window.onYouTubeIframeAPIReady = () => {
      cleanup()
      resolve()
      previousCallback?.()
    }
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = fail
    document.head.append(script)
  }).catch((error: unknown) => {
    apiPromise = null
    throw error
  })

  return apiPromise
}

export function playerErrorMessage(code: number): string {
  switch (code) {
    case 2: return 'YouTube rejected this video link. Check the link, or skip this video.'
    case 5: return 'This video could not play in this browser. Retry it, or skip this video.'
    case 100: return 'This video is unavailable. It may be private or have been removed. You can skip it.'
    case 101:
    case 150: return 'This video’s owner does not allow embedded playback. You can skip this video.'
    case 153: return 'YouTube could not identify this page. Check browser privacy settings, then retry or skip.'
    default: return `YouTube reported an error (${code}). Retry it, or skip this video.`
  }
}
