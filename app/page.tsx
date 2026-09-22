// Aether — consumer session viewer (Apple Developer Videos UX + xAI shell)
'use client';

import { useCallback, useRef, useState } from 'react';
import type { AnalyzeResponse, Scene } from '@/lib/types';
import { AnalyzeResponseSchema } from '@/lib/types';

type Tab = 'about' | 'chapters';

function formatRuntime(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function AetherPage() {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('chapters');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = useCallback(
    (f: File | null) => {
      setFile(f);
      setResult(null);
      setError(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(f ? URL.createObjectURL(f) : null);
    },
    [previewUrl],
  );

  const openMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      else if (url.trim()) form.append('url', url.trim());
      else throw new Error('Choose something to watch from your library or paste a link.');

      const res = await fetch('/api/analyze', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not open this.');
      const parsed = AnalyzeResponseSchema.parse(json);
      setResult(parsed);
      setActiveChapter(0);
      setTab('chapters');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [file, url]);

  const jumpToChapter = useCallback((chapter: Scene) => {
    setActiveChapter(chapter.index);
    const v = videoRef.current;
    if (v) {
      v.currentTime = chapter.seconds;
      v.play().catch(() => {});
      setPlaying(true);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const sessionTitle = result?.title ?? (file?.name?.replace(/\.[^.]+$/, '') ?? 'Your video');
  const runtime = formatRuntime(result?.durationSeconds);
  const hasVideo = previewUrl && file?.type.startsWith('video/');
  const showSession = Boolean(result || previewUrl);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] pb-24">
      {/* xAI shell — minimal */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 md:max-w-2xl">
          <span className="text-base font-normal tracking-tight">Aether</span>
          <button
            type="button"
            className="btn-cta px-4 py-1.5 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Add
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </nav>
      </header>

      <main className="mx-auto max-w-lg px-0 md:max-w-2xl">
        {!showSession && (
          <section className="px-4 py-16 text-center">
            <h2 className="text-3xl font-normal tracking-tight text-white md:text-4xl">
              Watch anything,
              <br />
              chapter by chapter
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-sm text-[var(--muted)]">
              Open a video from your library or paste a link. Jump to any moment from the chapter list.
            </p>
            <div className="mt-8 space-y-3 px-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a link"
                className="w-full rounded-xl border border-white/15 bg-[var(--chrome)] px-4 py-3.5 text-sm text-white outline-none placeholder:text-[var(--muted)] focus:border-white/30"
              />
              <button
                type="button"
                disabled={loading}
                onClick={openMedia}
                className="btn-cta w-full py-3.5 text-sm disabled:opacity-50"
              >
                {loading ? 'Opening…' : 'Watch'}
              </button>
            </div>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </section>
        )}

        {showSession && (
          <>
            {/* Apple Developer Videos — session card (light) */}
            <article className="overflow-hidden bg-[var(--session-bg)] text-[var(--session-ink)] shadow-2xl md:mx-4 md:mt-6 md:rounded-2xl">
              <div className="relative aspect-video w-full bg-black">
                {hasVideo && (
                  <>
                    <video
                      ref={videoRef}
                      src={previewUrl!}
                      className="h-full w-full object-contain"
                      playsInline
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                    {!playing && (
                      <button
                        type="button"
                        aria-label="Play"
                        onClick={togglePlay}
                        className="play-overlay absolute inset-0 flex items-center justify-center"
                      >
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
                          ▶
                        </span>
                      </button>
                    )}
                  </>
                )}
                {previewUrl && file?.type.startsWith('image/') && (
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                )}
                {!previewUrl && result?.scenes[activeChapter]?.thumbnailUrl && (
                  <img
                    src={result.scenes[activeChapter].thumbnailUrl!}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="px-4 pb-6 pt-4 md:px-6">
                <h1 className="text-xl font-semibold leading-tight tracking-tight md:text-2xl">
                  {sessionTitle}
                </h1>
                {runtime && (
                  <p className="mt-1 text-sm font-medium text-[var(--session-muted)]">{runtime}</p>
                )}

                <p className="mt-3 text-sm leading-relaxed text-[var(--session-muted)]">
                  {result?.scenes.length
                    ? `This session is split into ${result.scenes.length} chapters. Tap a chapter to jump to that moment.`
                    : 'Add a link below and tap Watch to load chapters.'}
                </p>

                {!result && (
                  <div className="mt-4 space-y-2">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Paste a link"
                      className="w-full rounded-lg border border-[var(--hairline-light)] bg-[var(--session-fill)] px-3 py-2.5 text-sm outline-none focus:border-[#0066cc]"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={openMedia}
                      className="btn-apple w-full py-2.5 disabled:opacity-50"
                    >
                      {loading ? 'Opening…' : 'Watch'}
                    </button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </div>
                )}

                <div className="mt-6 flex gap-6 border-b border-[var(--hairline-light)] text-sm">
                  {(['about', 'chapters'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`pb-2.5 capitalize ${tab === t ? 'tab-session-active' : 'tab-session-idle'}`}
                    >
                      {t === 'chapters' ? 'Chapters' : 'About'}
                    </button>
                  ))}
                </div>

                <div className="mt-4 min-h-[120px] text-sm">
                  {tab === 'about' && (
                    <p className="leading-relaxed text-[var(--session-muted)]">
                      Aether helps you follow long videos the same way you browse a great talk—title,
                      runtime, and a clear chapter list so you never lose your place.
                    </p>
                  )}
                  {tab === 'chapters' && (
                    <ul>
                      {(result?.scenes ?? []).map((ch) => (
                        <li key={ch.index} className="border-b border-[var(--hairline-light)] last:border-0">
                          <button
                            type="button"
                            onClick={() => jumpToChapter(ch)}
                            className="flex w-full items-center gap-3 py-3.5 text-left active:bg-[var(--session-fill)]"
                          >
                            <span className="w-12 shrink-0 text-xs tabular-nums text-[var(--session-muted)]">
                              {ch.timecode}
                            </span>
                            <span className="flex-1 font-medium text-[var(--session-ink)]">{ch.title}</span>
                            <span className="text-[var(--session-muted)]" aria-hidden>
                              ›
                            </span>
                          </button>
                        </li>
                      ))}
                      {!result?.scenes.length && (
                        <li className="py-6 text-center text-[var(--session-muted)]">
                          Chapters appear after you tap Watch.
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {result && result.scenes.length > 1 && (
                  <p className="mt-6 text-xs text-[var(--session-muted)]">
                    {result.scenes.length} chapters
                  </p>
                )}
              </div>
            </article>
          </>
        )}
      </main>

      {/* Consumer tab bar (Apple Developer app pattern) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-lg justify-around py-2 text-[10px] text-[var(--muted)] md:max-w-2xl">
          {[
            { label: 'Home', active: !showSession },
            { label: 'Library', active: false },
            { label: 'Watch', active: showSession },
            { label: 'You', active: false },
          ].map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={`flex flex-col items-center gap-0.5 px-3 py-1 ${item.active ? 'text-white' : ''}`}
              >
                <span className="text-lg opacity-80">●</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
