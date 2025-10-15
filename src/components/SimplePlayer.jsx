import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

// Ultra-reliable lean player using native <video/>
// - Stable absolute seeking with server-side seek for transcoded streams (?t=)
// - Consistent 10s skips using absolute timeline
// - Stable duration from /stream-info with fallbacks
// - Subtitle cue shifting when using server-side seek (timestamp reset to 0)
// - Freeze watchdog to auto-recover when playback stalls later in the stream

export default function SimplePlayer({
  videoSrc,
  onTimeUpdate,
  initialTime = 0,
  availableSubtitles = [],
  availableAudioTracks = [],
}) {
  const videoEl = useRef(null);
  const wrapperRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [stableDuration, setStableDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Video yükleniyor...');

  // Subtitles UI state
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subDebug, setSubDebug] = useState({ mode: '', cues: 0, active: 0 });
  const [subtitlesReady, setSubtitlesReady] = useState(false);
  const lastSubsRef = useRef([]);
  const subRefreshIntervalRef = useRef(null);

  // Transcoded seek base offset
  const baseOffsetRef = useRef(0);
  const lastAbsoluteSeekRef = useRef(null);
  const srcBaseRef = useRef({ base: '', isTrans: false });

  // Freeze watchdog
  const lastWatchRef = useRef({ t: 0, ts: 0, stuckCount: 0 });
  
  // Autoplay attempt tracker
  const autoplayAttemptedRef = useRef(false);

  const isTranscoded = useMemo(() => (videoSrc || '').includes('/streamfile-transcode/'), [videoSrc]);

  const parseMagnetFilename = (src) => {
    try {
      const re = /\/(streamfile(?:-transcode)?|dash|hls)\/([^/]+)\/([^?]+)/;
      const m = src.match(re);
      if (!m) return null;
      return { magnet: m[2], filename: m[3] };
    } catch { return null; }
  };

  const buildTranscodedUrl = (absSec) => {
    const base = srcBaseRef.current.base || videoSrc;
    const u = new URL(base);
    u.searchParams.set('t', Math.max(0, Math.floor(absSec)).toString());
    u.searchParams.set('nocache', Date.now().toString());
    return u.toString();
  };

  // Shift cues by base offset (when transcoded timeline resets to 0)
  const shiftTrackCues = (trackEl, offset) => {
    try {
      if (!trackEl || !trackEl.track || !trackEl.track.cues) return;
      const track = trackEl.track;
      
      // Check if already shifted (mark on track object to prevent double-shifting)
      if (track._shifted) {
        console.log('📝 Cues already shifted, skipping');
        track.mode = 'showing';
        return;
      }
      
      const cues = track.cues;
      if (!cues || cues.length === 0) return;
      
      console.log(`📝 Shifting ${cues.length} cues by -${offset}s`);
      
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        const originalStart = cue.startTime;
        const originalEnd = cue.endTime;
        
        const ns = Math.max(0, originalStart - offset);
        const ne = Math.max(ns + 0.01, originalEnd - offset);
        
        cue.startTime = ns;
        cue.endTime = ne;
      }
      
      track._shifted = true; // Mark as shifted
      track.mode = 'showing';
      console.log('✅ Subtitle cues shifted successfully');
    } catch (e) {
      console.error('❌ Cue shift error:', e);
    }
  };

  // Schedule periodic subtitle refresh to get backend-updated cache
  const scheduleSubtitleRefresh = (subtitle) => {
    // Clear existing refresh timer
    if (subRefreshIntervalRef.current) {
      clearInterval(subRefreshIntervalRef.current);
    }
    
    let checkCount = 0;
    subRefreshIntervalRef.current = setInterval(() => {
      checkCount++;
      console.log(`🔄 Checking for updated subtitles (attempt ${checkCount})...`);
      
      // Reload subtitle with cache-busting to get updated version
      const freshSubUrl = subtitle.src.split('?')[0] + `?cb=${Date.now()}`;
      
      fetch(freshSubUrl)
        .then(res => res.text())
        .then(vttContent => {
          const newCueCount = (vttContent.match(/-->/g) || []).length;
          const v = videoEl.current;
          if (!v || !v.textTracks || v.textTracks.length === 0) return;
          
          const currentCueCount = v.textTracks[0].cues ? v.textTracks[0].cues.length : 0;
          
          if (newCueCount > currentCueCount) {
            console.log(`✅ Updated subtitles found: ${currentCueCount} → ${newCueCount} cues`);
            toast.success(`Altyazılar güncellendi: +${newCueCount - currentCueCount} cue`, { duration: 3000 });
            
            // Reload subtitles
            attachSubtitles([{ ...subtitle, src: freshSubUrl }]);
            
            // Stop checking if we have a good amount of cues
            if (newCueCount > 400) {
              clearInterval(subRefreshIntervalRef.current);
              console.log('✅ Sufficient cues loaded, stopped auto-refresh');
            }
          } else if (checkCount >= 6) {
            // Stop after 6 attempts (~3 minutes)
            console.log('⏹️ Stopped subtitle auto-refresh after 6 checks');
            toast.warning('Tam altyazı bulunamadı. Dosya tamamen indirildikten sonra tekrar deneyin.', { duration: 5000 });
            clearInterval(subRefreshIntervalRef.current);
          }
        })
        .catch(err => console.error('Subtitle refresh error:', err));
        
    }, 30000); // Check every 30 seconds (0.5, 1, 1.5, 2, 2.5, 3 minutes)
  };
  
  // Attach subtitles to native video and shift if needed
  const attachSubtitles = (srcList) => {
    const v = videoEl.current; if (!v) return;
    
    // Remove existing tracks
    const existingTracks = Array.from(v.querySelectorAll('track'));
    existingTracks.forEach(t => {
      try {
        // Properly clean up track before removal
        if (t.track) {
          t.track.mode = 'disabled';
        }
        t.remove();
      } catch {}
    });

    lastSubsRef.current = srcList || [];
    if (!srcList || srcList.length === 0) {
      setCurrentSubtitle(null);
      return;
    }

    const primary = srcList[0];
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = primary.label || 'Default';
    track.srclang = primary.lang || 'und';
    track.src = primary.src + (primary.src.includes('?') ? `&cb=${Date.now()}` : `?cb=${Date.now()}`);
    track.default = true;

    let loadAttempted = false;
    
    // When the cues load, optionally shift them if server-side seek used
    const onLoad = () => {
      try {
        loadAttempted = true;
        const hasValidCues = track.track && track.track.cues && track.track.cues.length > 0;
        
        if (!hasValidCues) {
          console.warn('⚠️ Track loaded but no cues found');
          setLoadingStatus('⚠️ Altyazı yükleme sorunu (cue yok)');
          setSubtitlesReady(true); // Allow video to start anyway
          return;
        }
        
        if (srcBaseRef.current.isTrans && (baseOffsetRef.current || 0) > 0) {
          shiftTrackCues(track, baseOffsetRef.current);
          console.log(`📝 Subtitles loaded and shifted by ${baseOffsetRef.current}s`);
        } else {
          if (track.track) {
            // Use 'showing' directly for better stability
            track.track.mode = 'showing';
            const cueCount = track.track.cues.length;
            console.log(`✅ Subtitles loaded successfully: ${cueCount} cues`);
            
            // Mark subtitles as ready
            setSubtitlesReady(true);
            setLoadingStatus(`✅ Altyazılar hazır (${cueCount} cue)`);
            
            // If cue count seems low (<400), schedule aggressive refresh
            if (cueCount < 400) {
              console.log(`⏰ Cue count: ${cueCount} - will aggressively check for complete subtitles`);
              toast.info(`Altyazılar yüklendi: ${cueCount} cue (arka planda güncelleme aranacak)`, { duration: 3000 });
              scheduleSubtitleRefresh(primary);
            } else {
              console.log(`✅ Complete subtitles: ${cueCount} cues`);
              toast.success(`Altyazılar tamamen yüklendi: ${cueCount} cue`, { duration: 2000 });
            }
          }
        }
      } catch (e) {
        console.error('Subtitle load error:', e);
        setSubtitlesReady(true); // Allow video to start on error
      }
      track.removeEventListener('load', onLoad);
    };
    
    const onError = (e) => {
      console.warn('⚠️ Subtitle track error - attempting force load anyway');
      track.removeEventListener('error', onError);
      
      // Wait a bit and check if cues loaded despite error
      setTimeout(() => {
        if (track.track && track.track.cues && track.track.cues.length > 0) {
          console.log('✅ Cues loaded despite error event');
          track.track.mode = 'showing';
        } else if (!loadAttempted) {
          console.error('❌ Subtitle load failed completely');
        }
      }, 1000);
    };
    
    track.addEventListener('load', onLoad);
    track.addEventListener('error', onError, { once: true });

    // REMOVED: ensureShowing on cuechange - it was too aggressive and caused flickering
    // The watchdog will handle mode recovery if needed

    v.appendChild(track);
    
    // Small delay to ensure track is attached before setting state
    setTimeout(() => {
      setCurrentSubtitle(primary);
      // Force mode to showing after attachment
      if (track.track) {
        track.track.mode = 'showing';
      }
    }, 100);
  };

  // Absolute seek that works for both native and transcoded streams
  const seekTo = (absSec) => {
    const v = videoEl.current;
    if (!v) return;
    
    const dur = stableDuration > 0 ? stableDuration : (isFinite(v.duration) && v.duration > 0 ? v.duration : 0);
    let target = Math.max(0, absSec);
    // For transcoded streams, do not clamp by duration; server can start anywhere
    if (!srcBaseRef.current.isTrans) {
      if (dur > 0 && target >= dur) target = Math.max(0, dur - 1);
    }

    lastAbsoluteSeekRef.current = target;

    if (srcBaseRef.current.isTrans) {
      // Transcoded: reload from target time
      const wasPlaying = !v.paused && !v.ended;
      try {
        try { v.pause(); } catch {}
        const newUrl = buildTranscodedUrl(target);
        baseOffsetRef.current = Math.floor(target);
        v.src = newUrl;
        v.load();
        // Re-attach subs after src change
        if (lastSubsRef.current && lastSubsRef.current.length > 0) {
          setTimeout(() => attachSubtitles(lastSubsRef.current), 0);
        }
        if (wasPlaying) {
          const playLater = () => { v.play().catch(() => {}); v.removeEventListener('canplay', playLater); };
          v.addEventListener('canplay', playLater);
        }
      } catch (e) {
        try { v.currentTime = target; } catch {}
      }
    } else {
      // Direct stream: native seek only (no pause/resume to avoid glitches)
      try {
        v.currentTime = target;
      } catch (err) {
        console.warn('Seek failed:', err);
      }
    }
  };

  // Skip helpers
  const skip = (delta) => {
    const v = videoEl.current;
    if (!v) return;
    const base = (srcBaseRef.current.isTrans ? (baseOffsetRef.current || 0) : 0) + (v.currentTime || 0);
    seekTo(base + delta);
    toast.info(`${delta > 0 ? '⏩' : '⏪'} ${Math.abs(delta)}s`, { duration: 500 });
  };

  // Fetch stable duration from API
  const fetchDuration = async () => {
    try {
      const parsed = parseMagnetFilename(videoSrc);
      if (!parsed) return;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:64621';
      const url = `${backendUrl}/stream-info/${parsed.magnet}/${parsed.filename}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) return;
      const data = await res.json();
      if (data && isFinite(data.duration) && data.duration > 0) {
        setStableDuration(data.duration);
      }
    } catch {}
  };

  // Init on source change
  useEffect(() => {
    const v = videoEl.current;
    if (!v || !videoSrc) return;

    // Normalize base URL (drop existing query for consistent rebuild)
    try {
      const u = new URL(videoSrc);
      srcBaseRef.current = { base: `${u.origin}${u.pathname}`, isTrans: isTranscoded };
    } catch {
      srcBaseRef.current = { base: videoSrc, isTrans: isTranscoded };
    }

    // COMPLETE RESET - prevent state corruption
    baseOffsetRef.current = 0;
    lastAbsoluteSeekRef.current = null;
    autoplayAttemptedRef.current = false;
    lastWatchRef.current = { t: 0, ts: 0, stuckCount: 0 };
    setIsReady(false);
    setShowOverlay(true);
    setLoadProgress(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setSubDebug({ mode: '', cues: 0, active: 0 });
    setSubtitlesReady(false); // Reset subtitle ready state
    setLoadingStatus('Video yükleniyor...');

    // HARD reset video element state
    try {
      v.pause();
      v.removeAttribute('src');
      v.load(); // Clear any buffered data
    } catch {}

    // Small delay before setting new source (prevents state conflicts)
    setTimeout(() => {
      v.src = videoSrc;
      v.preload = 'auto';
      v.playsInline = true;
      v.crossOrigin = 'anonymous';
      v.autoplay = false;
      v.load(); // Force fresh load
    }, 100);

    // Duration probing
    setStableDuration(0);
    fetchDuration();

    // Auto-jump to initialTime
    const onLoadedMeta = () => {
      try {
        // Attach subtitles AFTER video metadata is loaded
        if (availableSubtitles && availableSubtitles.length > 0) {
          setLoadingStatus('⏳ Altyazılar yükleniyor...');
          setTimeout(() => attachSubtitles(availableSubtitles), 200);
        } else {
          // Try default subtitle endpoint (track 0)
          const parsed = parseMagnetFilename(videoSrc);
          if (parsed) {
            setLoadingStatus('⏳ Altyazılar yükleniyor...');
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:64621';
            const subUrl = `${backendUrl}/subtitle/${parsed.magnet}/${parsed.filename}/0`;
            setTimeout(() => attachSubtitles([{ label: 'Default', lang: 'und', src: subUrl }]), 200);
          } else {
            // No subtitles available - mark as ready immediately
            console.log('ℹ️ No subtitles available for this video');
            setSubtitlesReady(true);
            setLoadingStatus('Video hazır (altyazı yok)');
          }
        }
        
        if (initialTime > 0) {
          if (srcBaseRef.current.isTrans) {
            seekTo(initialTime);
          } else {
            v.currentTime = initialTime;
          }
          toast.info(`⏩ ${Math.floor(initialTime/60)}:${String(Math.floor(initialTime%60)).padStart(2,'0')}`, { duration: 1500 });
        }
      } catch {}
    };

    const tryAutoplay = () => {
      if (autoplayAttemptedRef.current) return;
      if (!v || v.readyState < 3) return; // HAVE_FUTURE_DATA
      
      // WAIT for subtitles to be ready before playing
      if (!subtitlesReady && availableSubtitles && availableSubtitles.length > 0) {
        console.log('⏳ Waiting for subtitles to load before autoplay...');
        setLoadingStatus('⏳ Altyazılar yükleniyor, lütfen bekleyin...');
        return;
      }
      
      autoplayAttemptedRef.current = true;
      console.log('🎬 Attempting autoplay (subtitles ready:', subtitlesReady, ', readyState:', v.readyState, ')');
      
      setShowOverlay(false);
      v.play().then(() => {
        console.log('✅ Autoplay successful');
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('⚠️ Autoplay blocked:', err);
        setIsPlaying(false);
        setShowOverlay(true);
      });
    };

    const onCanPlay = () => {
      setIsReady(true);
      console.log('🎯 canplay event, readyState:', v.readyState);
      // Try autoplay when basic playback is possible
      setTimeout(() => tryAutoplay(), 100);
    };

    const onCanPlayThrough = () => {
      console.log('✨ canplaythrough event, readyState:', v.readyState);
      // Try autoplay when video is fully buffered
      setTimeout(() => tryAutoplay(), 50);
    };
    
    const onLoadedData = () => {
      console.log('📦 loadeddata event, readyState:', v.readyState);
      // Try autoplay when first frame is loaded
      setTimeout(() => tryAutoplay(), 50);
    };

    const onProgress = () => {
      if (v.buffered.length > 0) {
        const buffered = v.buffered.end(0);
        const duration = v.duration || stableDuration || 1;
        setLoadProgress(Math.min(100, (buffered / duration) * 100));
      }
    };

    const onTimeUpdateHandler = () => {
      const base = srcBaseRef.current.isTrans ? (baseOffsetRef.current || 0) : 0;
      const eff = (isFinite(v.currentTime) ? v.currentTime : 0) + base;
      setCurrentTime(eff);
      if (typeof onTimeUpdate === 'function') onTimeUpdate(eff, stableDuration || v.duration || 0);
      
      // Keep subtitle track showing on every timeupdate
      if (currentSubtitle && v.textTracks && v.textTracks.length > 0) {
        const track = v.textTracks[0];
        if (track) {
          if (track.mode !== 'showing' && track.mode !== 'disabled') {
            console.log('⚡ Track mode changed to:', track.mode, '→ forcing showing');
            track.mode = 'showing';
          }
          // Update debug info every second
          if (Math.floor(eff) !== Math.floor(currentTime)) {
            setSubDebug({
              mode: track.mode,
              cues: track.cues?.length || 0,
              active: track.activeCues?.length || 0
            });
          }
        }
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      // Hide overlay when playback actually starts
      setShowOverlay(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onWaiting = () => {
      console.log('⏳ Buffering...');
      setIsBuffering(true);
    };
    const onPlaying = () => {
      console.log('▶️ Playing resumed');
      setIsBuffering(false);
    };

    // Wire events
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('loadeddata', onLoadedData);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('canplaythrough', onCanPlayThrough);
    v.addEventListener('progress', onProgress);
    v.addEventListener('timeupdate', onTimeUpdateHandler);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('loadeddata', onLoadedData);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('canplaythrough', onCanPlayThrough);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('timeupdate', onTimeUpdateHandler);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      
      // COMPLETE cleanup on unmount/src change
      autoplayAttemptedRef.current = false;
      lastWatchRef.current = { t: 0, ts: 0, stuckCount: 0 };
      
      // Clear subtitle refresh timer
      if (subRefreshIntervalRef.current) {
        clearInterval(subRefreshIntervalRef.current);
        subRefreshIntervalRef.current = null;
      }
      
      try { 
        v.pause(); 
        v.removeAttribute('src');
        // Remove all subtitle tracks
        Array.from(v.querySelectorAll('track')).forEach(t => t.remove());
      } catch {}
      v.load(); // Clear buffer
    };
  }, [videoSrc, isTranscoded, initialTime, availableSubtitles, onTimeUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const v = videoEl.current; if (!v) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      switch (e.code) {
        case 'Space': 
          e.preventDefault(); 
          if (v.paused) {
            v.play().then(() => setShowOverlay(false)).catch(()=>{});
          } else {
            v.pause();
          }
          break;
        case 'ArrowLeft': e.preventDefault(); skip(-10); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        case 'BracketLeft': e.preventDefault(); skip(-1); break;
        case 'BracketRight': e.preventDefault(); skip(1); break;
        case 'KeyM': e.preventDefault(); v.muted = !v.muted; break;
        case 'KeyF': e.preventDefault(); toggleFullscreen(); break;
        default: break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Subtitle watchdog: AGGRESSIVE mode to keep subtitles visible
  useEffect(() => {
    const lastReloadRef = { time: 0 }; // Prevent frequent reloads
    
    const id = setInterval(() => {
      const v = videoEl.current; if (!v) return;
      if (!currentSubtitle) return;
      const tracks = v.textTracks;
      
      // No tracks at all - re-attach immediately
      if (!tracks || tracks.length === 0) {
        const now = Date.now();
        if (now - lastReloadRef.time > 5000) { // 5s between reloads (increased)
          lastReloadRef.time = now;
          console.warn('⚠️ No subtitle tracks found, re-attaching...');
          attachSubtitles([currentSubtitle]);
        }
        return;
      }
      
      // Find track that should be showing (by label)
      let desired = null;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === (currentSubtitle.label || 'Default')) { 
          desired = tracks[i]; 
          break; 
        }
      }
      // If none matched, fallback to any track
      if (!desired) desired = tracks[0] || null;
      if (!desired) return;
      
      // FORCE showing mode every check (browser might change it)
      if (desired.mode !== 'showing') {
        try { 
          desired.mode = 'showing'; 
          console.log('🔄 Forced subtitle track to showing (was:', desired.mode, ')');
        } catch {}
      }
      
      // DON'T reload based on cues - they might load async
      // The timeupdate handler will show if subs are actually working
      // Only log status for debugging
      const cues = desired.cues;
      if (cues && cues.length > 0) {
        const activeCues = desired.activeCues ? desired.activeCues.length : 0;
        // Subtitles working fine, no action needed
      }
    }, 2000); // Check every 2s
    
    return () => clearInterval(id);
  }, [currentSubtitle]);

  // Autoplay polling: aggressive retry if events don't fire
  useEffect(() => {
    if (!videoSrc) return;
    
    const checkInterval = setInterval(() => {
      const v = videoEl.current;
      if (!v || autoplayAttemptedRef.current) return;
      
      // Check if video AND subtitles are ready
      const videoReady = v.readyState >= 3 && v.paused && showOverlay;
      const subsReady = subtitlesReady || !availableSubtitles || availableSubtitles.length === 0;
      
      if (videoReady && subsReady) {
        console.log('🔄 Polling: Video AND subtitles ready, attempting autoplay');
        const wasAttempted = autoplayAttemptedRef.current;
        autoplayAttemptedRef.current = true;
        
        setShowOverlay(false);
        v.play().then(() => {
          console.log('✅ Polling autoplay successful');
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('⚠️ Polling autoplay blocked:', err);
          setIsPlaying(false);
          setShowOverlay(true);
          autoplayAttemptedRef.current = wasAttempted;
        });
      } else if (videoReady && !subsReady) {
        console.log('⏳ Polling: Video ready but waiting for subtitles...');
        setLoadingStatus('⏳ Altyazılar yükleniyor...');
      }
    }, 500); // Check every 500ms
    
    return () => clearInterval(checkInterval);
  }, [videoSrc, showOverlay, subtitlesReady, availableSubtitles]);

  // Freeze watchdog: if time doesn't advance, auto-recover
  useEffect(() => {
    const id = setInterval(() => {
      const v = videoEl.current; if (!v) return;
      if (v.paused || v.ended) { lastWatchRef.current.stuckCount = 0; return; }
      const now = Date.now();
      const cur = v.currentTime || 0;
      const last = lastWatchRef.current;
      if (last.ts === 0) {
        last.ts = now; last.t = cur; return;
      }
      const dt = (now - last.ts) / 1000;
      const adv = cur - last.t;
      if (dt >= 1.5) {
        if (adv < 0.05) {
          last.stuckCount += 1;
        } else {
          last.stuckCount = 0;
        }
        last.ts = now; last.t = cur;
        if (last.stuckCount >= 2) { // ~3s stuck
          const base = srcBaseRef.current.isTrans ? (baseOffsetRef.current || 0) : 0;
          const abs = base + cur + 0.2;
          if (srcBaseRef.current.isTrans) {
            seekTo(abs);
          } else {
            try { v.currentTime = cur + 0.1; } catch {}
          }
          last.stuckCount = 0;
          console.warn('Watchdog: playback stalled, recovering at', abs.toFixed(2), 's');
        }
      }
    }, 800);
    return () => clearInterval(id);
  }, []);

  const togglePlayPause = () => {
    const v = videoEl.current; if (!v) return;
    if (v.paused) {
      v.play().then(() => {
        setShowOverlay(false);
      }).catch(()=>{});
    } else {
      v.pause();
    }
  };

  const toggleFullscreen = () => {
    const container = wrapperRef.current; if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const formatTime = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2,'0')}`;
  };

  return (
    <div ref={wrapperRef} className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl">
      {/* Video */}
      <video
        ref={videoEl}
        className="w-full h-full"
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        style={{ objectFit: 'contain', backgroundColor: 'black' }}
      >
        {/* Native subtitle tracks will be added dynamically via attachSubtitles */}
      </video>
      
      {/* Force subtitle visibility with CSS */}
      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          font-size: 1.2em;
          font-family: Arial, sans-serif;
          text-shadow: 0 0 4px black, 0 0 8px black;
        }
        video::-webkit-media-text-track-display {
          z-index: 5 !important;
          pointer-events: none;
        }
      `}</style>

      {/* Buffering Spinner (seek/rebuffer) */}
      {isBuffering && !showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-15 pointer-events-none">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-violet-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-violet-500 rounded-full animate-spin"></div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center gap-6">
            {/* Spinner */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-violet-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-violet-500 rounded-full animate-spin"></div>
            </div>
            
            {/* Status */}
            <div className="text-center space-y-2">
              <p className="text-white text-lg font-semibold">{loadingStatus}</p>
              {loadProgress > 0 && (
                <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  ></div>
                </div>
              )}
              <p className="text-gray-400 text-sm">
                {loadProgress > 0 ? `Video: ${Math.floor(loadProgress)}%` : ''}
                {!subtitlesReady && availableSubtitles && availableSubtitles.length > 0 ? ' • Altyazılar bekleniyor...' : ''}
              </p>
            </div>

            {/* Manual play button if autoplay blocked */}
            {isReady && (
              <button
                onClick={() => {
                  const v = videoEl.current;
                  if (v) {
                    v.play().then(() => {
                      setIsPlaying(true);
                      setShowOverlay(false);
                    }).catch(console.error);
                  }
                }}
                className="mt-4 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                ▶️ Oynat
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-4 z-10 select-none">
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-gray-600 rounded-full cursor-pointer mb-3 hover:h-2 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const denom = (stableDuration && isFinite(stableDuration) && stableDuration > 0) ? stableDuration : 0;
            const v = videoEl.current; if (!v) return;
            const nativeDur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
            const useDenom = denom || nativeDur || (24*60);
            let target = pos * useDenom;
            if (!isTranscoded && useDenom > 0 && target >= useDenom) target = Math.max(0, useDenom - 1);
            seekTo(target);
            toast.info(`⏩ ${formatTime(target)}`, { duration: 800 });
          }}
        >
          <div
            className="h-full bg-violet-500 rounded-full"
            style={{ width: (() => {
              const d = (stableDuration && isFinite(stableDuration) && stableDuration > 0) ? stableDuration : 0;
              if (!d) return '0%';
              return `${Math.min(100, Math.max(0, (currentTime / d) * 100))}%`;
            })() }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlayPause} className="text-2xl hover:text-violet-400 p-2 hover:bg-white/10 rounded-lg transition">
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Skip */}
            <button onClick={() => skip(-10)} className="text-lg hover:text-violet-400 p-2 hover:bg-white/10 rounded-lg transition">⏪</button>
            <button onClick={() => skip(10)} className="text-lg hover:text-violet-400 p-2 hover:bg-white/10 rounded-lg transition">⏩</button>

            {/* Time */}
            <span className="text-sm font-medium bg-black/40 px-3 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(stableDuration || 0)}
            </span>

            {/* Subs */}
            <div className="relative">
              <button onClick={() => setShowSubMenu(!showSubMenu)} className="text-sm hover:text-violet-400 px-3 py-2 hover:bg-white/10 rounded-lg font-medium transition bg-violet-600/20 border border-violet-500/30">
                📝 {currentSubtitle ? (currentSubtitle.label || 'Sub') : 'Altyazı'}
              </button>
              {showSubMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-2 min-w-[260px] max-w-[320px] shadow-2xl z-30">
                  <div className="text-xs text-gray-400 mb-2 font-bold px-2 flex items-center justify-between">
                    <span>📝 ALTYAZI</span>
                    <span className="text-violet-400">{availableSubtitles?.length || 1}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    <button
                      onClick={() => { attachSubtitles([]); setCurrentSubtitle(null); setShowSubMenu(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${!currentSubtitle ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                    >
                      ❌ Kapalı
                    </button>
                    {(availableSubtitles && availableSubtitles.length > 0 ? availableSubtitles : (currentSubtitle ? [currentSubtitle] : [])).map((sub, i) => (
                      <button key={i} onClick={() => { attachSubtitles([sub]); setCurrentSubtitle(sub); setShowSubMenu(false); }} className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${currentSubtitle?.label === sub.label ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
                        <span className="truncate font-medium">{sub.label || `Subtitle ${i+1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs bg-black/40 px-2 py-1 rounded">{playbackRate.toFixed(2)}x</div>
            <button onClick={toggleFullscreen} className="text-xl hover:text-violet-400 p-2 hover:bg-white/10 rounded-lg transition">⛶</button>
          </div>
        </div>
      </div>

      {/* Badge & Debug Info */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        <div className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md text-green-400 text-xs font-bold border border-green-500/30">
          🎬 Native Player (Stable)
        </div>
        {currentSubtitle && subDebug.cues > 0 && (
          <div className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md text-xs font-mono border border-violet-500/30">
            <div className="text-violet-400 font-bold mb-1">📝 Subs:</div>
            <div className="text-white space-y-0.5">
              <div>Mode: <span className={subDebug.mode === 'showing' ? 'text-green-400' : 'text-red-400'}>{subDebug.mode}</span></div>
              <div>Cues: {subDebug.cues}</div>
              <div className={subDebug.active > 0 ? 'text-green-400 font-bold' : ''}>Active: {subDebug.active}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
