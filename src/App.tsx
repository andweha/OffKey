import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePlayback } from './usePlayback'
import { videoIdFromUrl } from './youtube'

const phaseLabels = {
  idle: 'Ready for a test',
  loading: 'Waiting for playback',
  playing: 'Playing',
  paused: 'Paused',
  blocked: 'Click to resume',
  error: 'Video couldn’t play',
  finished: 'Test complete',
}

export function App() {
  const controls = usePlayback()
  const { playback, ready, setupError } = controls
  const [links, setLinks] = useState<[string, string]>(['', ''])
  const [errors, setErrors] = useState<[string, string]>(['', ''])
  const active = !['idle', 'finished'].includes(playback.phase)
  const canResume = ['paused', 'blocked'].includes(playback.phase)
  const status = setupError ? 'Player unavailable' : !ready ? 'Connecting to YouTube' : phaseLabels[playback.phase]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (active) return
    const ids = links.map(videoIdFromUrl)
    setErrors(ids.map((id) => id ? '' : 'Paste a full YouTube video link, such as https://www.youtube.com/watch?v=…') as [string, string])
    if (ids[0] && ids[1]) controls.start([ids[0], ids[1]])
  }

  return (
    <main>
      <header className="page-header">
        <a className="wordmark" href="/" aria-label="OffKey playback test">OffKey<span aria-hidden="true">.</span></a>
        <span className="test-label">Two-video playback test</span>
      </header>

      <div className="workspace">
        <section className="playback-panel" aria-label="Playback">
          <div className="player-frame">
            <div ref={controls.containerRef} className="player-container" />
          </div>

          <div className="playback-info" role="status" aria-live="polite">
            <div>
              <p className="eyebrow">{playback.ids ? `Video ${playback.index + 1} of 2` : 'Player'}</p>
              <h1>{status}</h1>
            </div>
            {playback.phase === 'playing' && <span className="playing-indicator" aria-hidden="true"><i /><i /><i /></span>}
          </div>

          {(setupError || playback.message) && (
            <div className="notice" role="alert">
              <p>{setupError || playback.message}</p>
              {setupError && <button className="secondary" onClick={() => window.location.reload()}>Reload page</button>}
            </div>
          )}

          <div className="transport" aria-label="Playback controls">
            {playback.phase === 'error' ? (
              <button className="secondary" onClick={controls.retry}>Retry video</button>
            ) : (
              <button className="secondary" disabled={!active} onClick={canResume ? controls.resume : controls.pause}>
                {playback.phase === 'blocked' ? 'Resume playback' : canResume ? 'Resume' : 'Pause'}
              </button>
            )}
            <button className="secondary" disabled={!active} onClick={controls.skip}>Skip video</button>
            <button className="text-button" disabled={!playback.ids} onClick={controls.reset}>Reset test</button>
          </div>
          {playback.phase === 'finished' && <p className="help">The sequence has ended. Start again to replay, or change the links for another test.</p>}
        </section>

        <section className="setup-panel" aria-labelledby="setup-title">
          <p className="eyebrow">Set up a test</p>
          <h2 id="setup-title">Two links. One player.</h2>
          <p className="intro">Start the first video. When it ends, the second should play automatically.</p>

          <form onSubmit={submit} noValidate>
            {[0, 1].map((index) => (
              <div className="field" key={index}>
                <label htmlFor={`video-${index}`}>Video {index + 1}</label>
                <input
                  id={`video-${index}`}
                  type="url"
                  value={links[index]}
                  disabled={active}
                  placeholder={index === 0 ? 'https://www.youtube.com/watch?v=…' : 'https://youtu.be/…'}
                  aria-invalid={Boolean(errors[index])}
                  aria-describedby={errors[index] ? `error-${index}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    const next: [string, string] = [...links]
                    next[index] = event.target.value
                    setLinks(next)
                    const nextErrors: [string, string] = [...errors]
                    nextErrors[index] = ''
                    setErrors(nextErrors)
                  }}
                />
                {errors[index] && <p className="field-error" id={`error-${index}`}>{errors[index]}</p>}
              </div>
            ))}
            <button className="primary" type="submit" disabled={!ready || Boolean(setupError) || active}>
              {playback.phase === 'finished' ? 'Start again' : 'Start test'}
            </button>
          </form>

          <p className="help">YouTube controls stay available inside the player. If a video can’t be embedded, retry it or skip to the next one.</p>
          <div className="sequence" aria-label="Test sequence">
            {[0, 1].map((index) => (
              <div className={`sequence-item ${active && playback.index === index ? 'current' : ''}`} key={index}>
                <span className="sequence-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>Video {index + 1}</strong>
                  <span>{playback.phase === 'finished' ? 'Sequence ended' : active && playback.index === index ? 'Selected' : active && playback.index > index ? 'Previous' : 'Waiting'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer>Playback prototype · No room or shared queue yet</footer>
    </main>
  )
}
