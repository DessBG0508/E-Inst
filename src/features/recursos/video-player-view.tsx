import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { isExternalEmbedVideo, getEmbedVideoUrl, detectVideoOrientation } from "./recursos-service";
import { resolvePlayableVideoUrl } from "./video-storage";
import type { VideoOrientation } from "@/lib/types";

export type ResolvedOrientation = "horizontal" | "vertical" | "square";

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VideoPlayerViewProps {
  videoUrl?: string;
  title?: string;
  orientation?: VideoOrientation;
  onOrientationDetected?: (orientation: ResolvedOrientation) => void;
  className?: string;
}

export function VideoPlayerView({
  videoUrl,
  title,
  orientation = "auto",
  onOrientationDetected,
  className = "",
}: VideoPlayerViewProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Direct HTML5 video player state
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onOrientationRef = useRef(onOrientationDetected);
  useEffect(() => {
    onOrientationRef.current = onOrientationDetected;
  }, [onOrientationDetected]);

  const initialOrientation = detectVideoOrientation(videoUrl, orientation);
  const [detectedOrientation, setDetectedOrientation] =
    useState<ResolvedOrientation>(initialOrientation);
  const [exactAspectRatio, setExactAspectRatio] = useState<string | null>(null);

  useEffect(() => {
    const nextInitial = detectVideoOrientation(videoUrl, orientation);
    setDetectedOrientation(nextInitial);
    setExactAspectRatio(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
    onOrientationRef.current?.(nextInitial);
  }, [videoUrl, orientation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!videoUrl) {
      setResolvedSrc(null);
      setIsLoading(false);
      return;
    }

    if (isExternalEmbedVideo(videoUrl)) {
      setResolvedSrc(videoUrl);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    async function resolve() {
      try {
        const src = await resolvePlayableVideoUrl(videoUrl);
        if (isMounted) {
          if (!src) {
            setResolvedSrc(null);
            setHasError(true);
          } else {
            setResolvedSrc(src);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    resolve();
    return () => {
      isMounted = false;
    };
  }, [videoUrl]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const handleSeek = (nextTime: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(nextTime)) return;
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (nextVol: number) => {
    const el = videoRef.current;
    const clamped = Math.max(0, Math.min(1, nextVol));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (el) {
      el.volume = clamped;
      el.muted = clamped === 0;
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (el) {
      el.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        el.volume = 0.8;
        setVolume(0.8);
      }
    }
  };

  const cyclePlaybackRate = () => {
    const el = videoRef.current;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate as (typeof PLAYBACK_SPEEDS)[number]);
    const nextRate = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackRate(nextRate);
    if (el) {
      el.playbackRate = nextRate;
    }
  };

  const handleSetPlaybackRate = (rate: number) => {
    const el = videoRef.current;
    setPlaybackRate(rate);
    if (el) {
      el.playbackRate = rate;
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      } else if (videoRef.current?.requestFullscreen) {
        await videoRef.current.requestFullscreen();
      }
    } catch {
      // Fullscreen unavailable in restricted context
    }
  };

  if (!videoUrl) return null;

  const isEmbed = isExternalEmbedVideo(videoUrl);
  const embedUrl = isEmbed ? getEmbedVideoUrl(videoUrl) : null;

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (Number.isFinite(videoEl.duration)) {
      setDuration(videoEl.duration);
    }
    videoEl.playbackRate = playbackRate;
    videoEl.volume = volume;
    videoEl.muted = isMuted;

    if (!w || !h) return;

    let nextOrientation: ResolvedOrientation = "horizontal";
    if (orientation && orientation !== "auto") {
      nextOrientation = orientation;
    } else if (h > w * 1.05) {
      nextOrientation = "vertical";
    } else if (Math.abs(w - h) / Math.max(w, h) < 0.08) {
      nextOrientation = "square";
    }

    setDetectedOrientation(nextOrientation);
    setExactAspectRatio(`${w} / ${h}`);
    onOrientationRef.current?.(nextOrientation);
  };

  const containerSizingClass =
    detectedOrientation === "vertical"
      ? "mx-auto w-full max-w-[330px] sm:max-w-[370px] max-h-[75vh]"
      : detectedOrientation === "square"
        ? "mx-auto w-full max-w-[460px]"
        : "mx-auto w-full max-w-3xl";

  const fallbackAspectRatio =
    detectedOrientation === "vertical"
      ? "9 / 16"
      : detectedOrientation === "square"
        ? "1 / 1"
        : "16 / 9";

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#0F1A12] shadow-sm transition-all duration-300 dark:border-[#2D3F2A] ${containerSizingClass} ${className}`}
    >
      <div
        style={{ aspectRatio: exactAspectRatio || fallbackAspectRatio }}
        className="relative w-full bg-zinc-950"
      >
        {isLoading ? (
          <div className="grid h-full w-full place-items-center bg-zinc-950 p-4 text-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-6 animate-spin text-[#8FC9B5]" />
              <span className="text-xs text-slate-300">Cargando video demostrativo...</span>
            </div>
          </div>
        ) : hasError || (!resolvedSrc && !embedUrl) ? (
          <div className="grid h-full w-full place-items-center bg-zinc-950 p-5 text-center text-white/75">
            <div className="flex max-w-md flex-col items-center gap-2">
              <VideoOff className="size-6 text-zinc-400" />
              <p className="text-xs font-medium text-slate-200">
                No se pudo reproducir este archivo de video aquí.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Si fue guardado en otro navegador o sesión, súbelo de nuevo desde el Panel del
                Psicólogo (MP4 H.264 o WebM, máx. 150 MB) o vincula un enlace de YouTube/Vimeo.
              </p>
            </div>
          </div>
        ) : isEmbed && embedUrl ? (
          <iframe
            src={embedUrl}
            title={title || "Video demostrativo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="group relative h-full w-full">
            <video
              ref={videoRef}
              key={resolvedSrc}
              src={resolvedSrc || undefined}
              playsInline
              onClick={togglePlay}
              onLoadedMetadata={handleVideoMetadata}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) {
                  setDuration(e.currentTarget.duration);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
              className="h-full w-full cursor-pointer bg-zinc-950 object-contain"
              preload="metadata"
            >
              Tu navegador no soporta la reproducción directa de este formato de video.
            </video>

            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Reproducir video"
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 transition-opacity hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="grid size-14 place-items-center rounded-full bg-[#1F4D2C]/95 text-white shadow-lg ring-2 ring-white/30 transition-transform hover:scale-105">
                  <Play className="ml-0.5 size-6 fill-current" />
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barra de controles institucionales para video directo (Play/Pause, Progreso, Volumen, Velocidad, Fullscreen) */}
      {!isLoading && !hasError && !isEmbed && resolvedSrc && (
        <div
          aria-label="Controles de reproducción de video"
          className="flex flex-col gap-2 border-t border-white/10 bg-[#0F1A12] px-3 py-2.5 text-white"
        >
          {/* Barra de progreso */}
          <div className="flex items-center gap-2.5">
            <span className="w-10 text-[11px] font-medium tabular-nums text-[#E5DFD3]">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              aria-label="Progreso del video"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={duration > 0 ? currentTime : 0}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[#8FC9B5]"
            />
            <span className="w-10 text-right text-[11px] font-medium tabular-nums text-[#E5DFD3]/75">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Botones de control */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pausar video" : "Reproducir video"}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#1F4D2C] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {isPlaying ? (
                  <>
                    <Pause className="size-3.5" />
                    <span className="hidden sm:inline">Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3.5 fill-current" />
                    <span className="hidden sm:inline">Reproducir</span>
                  </>
                )}
              </button>

              {/* Volumen */}
              <div className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Activar sonido" : "Silenciar video"}
                  className="cursor-pointer text-white/90 hover:text-[#8FC9B5] focus-visible:outline-none"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>
                <input
                  type="range"
                  aria-label="Volumen"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-14 cursor-pointer accent-[#8FC9B5] sm:w-20"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Selector de velocidad */}
              <div
                className="hidden items-center rounded-md border border-white/15 bg-white/5 p-0.5 sm:inline-flex"
                role="group"
                aria-label="Velocidad de reproducción"
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => handleSetPlaybackRate(speed)}
                    className={`cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
                      playbackRate === speed
                        ? "bg-[#8FC9B5] text-[#0F1A12]"
                        : "text-white/75 hover:text-white"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={cyclePlaybackRate}
                aria-label={`Velocidad ${playbackRate}x, cambiar velocidad`}
                className="inline-flex h-8 cursor-pointer items-center rounded-md border border-white/15 bg-white/5 px-2 text-[11px] font-semibold tabular-nums text-white hover:bg-white/10 sm:hidden"
              >
                {playbackRate}x
              </button>

              {/* Pantalla completa */}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
