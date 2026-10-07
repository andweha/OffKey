import { useEffect, useRef, useState } from 'react'
import { loadYouTubeApi, playerErrorMessage, videoIdFromUrl } from './youtube'

type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error' | 'finished'
type Session = { ids: [string, string]; index: number; active: boolean; hasPlayed: boolean }
type Playback = { phase: Phase; index: number; ids: [string, string] | null; message: string }

const initialPlayback: Playback = { phase: 'idle', index: 0, ids: null, message: '' }

export function usePlayback() {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const stateRef = useRef<Playback>(initialPlayback)
  const [playback, setPlayback] = useState<Playback>(initialPlayback)
  const [ready, setReady] = useState(false)
  const [setupError, setSetupError] = useState('')

  function publish(phase: Phase, message = '') {
    const session = sessionRef.current
    const next: Playback = {
      phase,
      index: session?.index ?? 0,
      ids: session?.ids ?? null,
      message,
    }
    stateRef.current = next
    setPlayback(next)
  }

  function loadCurrentVideo() {
    const session = sessionRef.current
    if (!session?.active || !playerRef.current) return
    session.hasPlayed = false
    publish('loading')
    playerRef.current.loadVideoById(session.ids[session.index])
  }

  function advance() {
    const session = sessionRef.current
    if (!session?.active) return
    if (session.index === 1) {
      // Deactivate before pausing: late player events must not restart the test.
      session.active = false
      publish('finished')
      playerRef.current?.pauseVideo()
    } else {
      session.index = 1
      loadCurrentVideo()
    }
  }

  useEffect(() => {
    let alive = true
    let player: YT.Player | null = null
    let readyTimeout: number | undefined

    void loadYouTubeApi().then(() => {
      if (!alive || !containerRef.current) return
      // YouTube replaces its target node. React owns only the outer container.
      const target = document.createElement('div')
      containerRef.current.replaceChildren(target)
      readyTimeout = window.setTimeout(() => {
        if (alive) setSetupError('The YouTube player did not become ready. Check your connection or content blocker, then reload this page.')
      }, 15_000)

      player = new window.YT.Player(target, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady(event) {
            if (!alive) return
            window.clearTimeout(readyTimeout)
            playerRef.current = event.target
            event.target.getIframe().title = 'YouTube playback test'
            setSetupError('')
            setReady(true)
          },
          onStateChange(event) {
            const session = sessionRef.current
            if (!alive || !session?.active) return
            const reportedId = videoIdFromUrl(event.target.getVideoUrl())
            if (reportedId !== session.ids[session.index]) return

            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                session.hasPlayed = true
                publish('playing')
                break
              case window.YT.PlayerState.PAUSED:
                if (session.hasPlayed) publish('paused')
                break
              case window.YT.PlayerState.ENDED:
                // Ignore duplicate ended events and events emitted while loading.
                if (
                  event.target.getPlayerState() === window.YT.PlayerState.ENDED &&
                  session.hasPlayed &&
                  !['loading', 'blocked', 'error'].includes(stateRef.current.phase)
                ) advance()
                break
            }
          },
          onError(event) {
            const session = sessionRef.current
            if (!alive || !session?.active) return
            const reportedId = videoIdFromUrl(event.target.getVideoUrl())
            if (reportedId && reportedId !== session.ids[session.index]) return
            publish('error', playerErrorMessage(event.data))
          },
          onAutoplayBlocked() {
            if (alive && sessionRef.current?.active && stateRef.current.phase !== 'error') {
              publish('blocked', 'Your browser blocked playback. Click Resume playback, or use the play button in the video.')
            }
          },
        },
      })
    }).catch((error: unknown) => {
      if (alive) setSetupError(error instanceof Error ? error.message : 'YouTube could not load. Reload this page to retry.')
    })

    return () => {
      alive = false
      window.clearTimeout(readyTimeout)
      playerRef.current = null
      player?.destroy()
    }
  }, [])

  function start(ids: [string, string]) {
    if (!ready || !playerRef.current) return
    sessionRef.current = { ids, index: 0, active: true, hasPlayed: false }
    loadCurrentVideo()
  }

  function pause() {
    if (!sessionRef.current?.active) return
    playerRef.current?.pauseVideo()
    publish('paused')
  }

  function resume() {
    if (!sessionRef.current?.active) return
    // Keep playback in this click handler so the browser sees a user gesture.
    publish('loading')
    playerRef.current?.playVideo()
  }

  function reset() {
    sessionRef.current = null
    publish('idle')
    playerRef.current?.stopVideo()
  }

  return {
    containerRef, playback, ready, setupError, start, pause, resume,
    skip: advance, retry: loadCurrentVideo, reset,
  }
}
