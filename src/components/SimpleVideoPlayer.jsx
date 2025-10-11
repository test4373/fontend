import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function SimpleVideoPlayer({ 
  videoSrc, 
  subtitleSrc,
  onTimeUpdate, 
  initialTime = 0,
  quality = '1080p',
  onQualityChange,
  upscaleAvailable = false,
  originalVideoSrc = null,
  availableQualities = ['480p', '720p', '1080p', '4K'],
  animeId = null,
  episodeNumber = null,
  magnetUri = null,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(0);
  const [subtitleSettings, setSubtitleSettings] = useState({
    fontSize: 18,
    fontFamily: 'Arial',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    outline: 'black',
    position: 'bottom',
    verticalPosition: 80,
    opacity: 1
  });
  const controlsTimeoutRef = useRef(null);
  const settingsRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const [watchProgress] = useState({
    currentTime: 0,
    duration: 0,
    watchedPercentage: 0,
    lastWatched: null
  });

  // Auto-hide controls
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying && !showSettings) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const video = videoRef.current;
      if (!video || showSettings) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          toast('⏯️ ' + (isPlaying ? 'Durduruldu' : 'Oynatılıyor'), { duration: 1000 });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          toast('⏪ 10 saniye geri', { duration: 1000 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          toast('⏩ 10 saniye ileri', { duration: 1000 });
          break;
        case 'ArrowUp':
          e.preventDefault();
          const newVolumeUp = Math.min(1, video.volume + 0.1);
          video.volume = newVolumeUp;
          setVolume(newVolumeUp);
          toast(`🔊 Ses: ${Math.round(newVolumeUp * 100)}%`, { duration: 1000 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newVolumeDown = Math.max(0, video.volume - 0.1);
          video.volume = newVolumeDown;
          setVolume(newVolumeDown);
          toast(`🔉 Ses: ${Math.round(newVolumeDown * 100)}%`, { duration: 1000 });
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          video.muted = !video.muted;
          toast(video.muted ? '🔇 Sessiz' : '🔊 Ses açık', { duration: 1000 });
          break;
        case 'Comma':
          e.preventDefault();
          const newRateDown = Math.max(0.25, video.playbackRate - 0.25);
          video.playbackRate = newRateDown;
          setPlaybackRate(newRateDown);
          toast(`🐌 Hız: ${newRateDown}x`, { duration: 1000 });
          break;
        case 'Period':
          e.preventDefault();
          const newRateUp = Math.min(2, video.playbackRate + 0.25);
          video.playbackRate = newRateUp;
          setPlaybackRate(newRateUp);
          toast(`🐇 Hız: ${newRateUp}x`, { duration: 1000 });
          break;
        case 'Digit0':
          e.preventDefault();
          video.currentTime = 0;
          toast('⏮️ Başa dön', { duration: 1000 });
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8':
        case 'Digit9':
          e.preventDefault();
          const percent = parseInt(e.code.replace('Digit', '')) / 10;
          video.currentTime = video.duration * percent;
          toast(`⏭️ ${Math.round(percent * 100)}% konumuna gidildi`, { duration: 1000 });
          break;
        case 'KeyS':
          e.preventDefault();
          setShowSettings(!showSettings);
          break;
        case 'KeyC':
          e.preventDefault();
          setSubtitlesEnabled(prev => !prev);
          toast(!subtitlesEnabled ? '📝 Altyazı açıldı' : '🚫 Altyazı kapatıldı', { duration: 1000 });
          break;
        case 'KeyJ':
          e.preventDefault();
          // Altyazıyı aşağı taşı
          const newPosDown = subtitleSettings.position === 'bottom' 
            ? Math.min(150, subtitleSettings.verticalPosition + 10)
            : Math.max(10, subtitleSettings.verticalPosition - 10);
          setSubtitleSettings(prev => ({ ...prev, verticalPosition: newPosDown }));
          toast(`📝 Altyazı ${subtitleSettings.position === 'bottom' ? 'aşağı' : 'yukarı'}: ${newPosDown}px`, { duration: 1000 });
          break;
        case 'KeyK':
          e.preventDefault();
          // Altyazıyı yukarı taşı
          const newPosUp = subtitleSettings.position === 'bottom' 
            ? Math.max(10, subtitleSettings.verticalPosition - 10)
            : Math.min(150, subtitleSettings.verticalPosition + 10);
          setSubtitleSettings(prev => ({ ...prev, verticalPosition: newPosUp }));
          toast(`📝 Altyazı ${subtitleSettings.position === 'bottom' ? 'yukarı' : 'aşağı'}: ${newPosUp}px`, { duration: 1000 });
          break;
        default:
          // Other keys - do nothing
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, showSettings]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // 🔥 INSTANT: Metadata = ready!
      setIsLoading(false);
      toast.success('⚡ Video hazır! Play\'e bas', { duration: 1500 });
      
      if (initialTime > 0) {
        video.currentTime = initialTime;
        console.log('⏩ Jumped to:', initialTime, 's');
      }
      
      // 🔥 OPTIMIZED: Enable subtitles without delay
      const textTracks = video.textTracks;
      if (textTracks && textTracks.length > 0) {
        for (let i = 0; i < textTracks.length; i++) {
          textTracks[i].mode = 'showing';
        }
        console.log(`📝 ${textTracks.length} subtitle track(s) enabled`);
      }
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      
      // 🔥 OPTIMIZED: Save progress less frequently (every 15 seconds)
      if (animeId && episodeNumber && Math.abs(time - lastSaveTime) >= 15) {
        setLastSaveTime(time);
        // Debounce the save to avoid blocking
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveWatchProgress(time, video.duration);
        }, 1000);
      }
      
      // 🔥 OPTIMIZED: Throttle onTimeUpdate callback
      if (onTimeUpdate && Math.abs(time - (video._lastUpdateTime || 0)) >= 2) {
        video._lastUpdateTime = time;
        onTimeUpdate(time, video.duration);
      }
    };

    const handleLoadedData = () => {
      console.log('📊 Video data loaded - readyState:', video.readyState);
      // 🔥 INSTANT: Enable immediately!
      setIsLoading(false);
      
      // Auto-restore progress when video is ready
      const progressKey = getWatchProgressKey();
      if (progressKey && initialTime === 0) {
        const saved = localStorage.getItem(progressKey);
        if (saved) {
          try {
            const progress = JSON.parse(saved);
            if (progress.watchedPercentage > 5 && progress.watchedPercentage < 90) {
              video.currentTime = progress.currentTime;
              toast.info(`📺 ${Math.round(progress.watchedPercentage)}% kaldığınız yerden devam`, {
                duration: 2000
              });
            }
          } catch (e) {
            console.log('Progress restore failed:', e);
          }
        }
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      resetControlsTimeout();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
    };

    const handleError = (e) => {
      console.error('❌ Video error:', e);
      setError('Video yüklenemedi. Backend çalıştığından emin olun.');
      setIsLoading(false);
      toast.error('❌ Video Hatası', {
        description: 'Video stream\'e erişilemiyor',
        duration: 5000
      });
    };

    const handleCanPlay = () => {
      console.log('✅ Video CAN PLAY - Ready for playback!');
      setIsLoading(false);
      setError(null);
      
      // 🔥 CRITICAL: Show toast to user
      toast.success('⚡ Video hazır! Play’e bas', {
        duration: 3000,
        action: {
          label: '▶️ Oynat',
          onClick: () => video.play()
        }
      });
    };

    const handleWaiting = () => {
      // 🔥 OPTIMIZED: Only show loading after 500ms to avoid flashing
      const waitingTimeout = setTimeout(() => {
        setIsLoading(true);
      }, 500);
      video._waitingTimeout = waitingTimeout;
    };

    const handleCanPlayThrough = () => {
      // 🔥 Clear waiting timeout if exists
      if (video._waitingTimeout) {
        clearTimeout(video._waitingTimeout);
        video._waitingTimeout = null;
      }
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTime, onTimeUpdate, isPlaying]);

  // Update video source with aggressive buffering
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    console.log('🔄 Setting video source:', videoSrc);
    setIsLoading(true);
    setError(null);
    
    // 🚀 OPTIMIZED: Better buffering strategy
    video.preload = 'auto'; // Download ASAP
    video.autoplay = false; // Don't auto-start (user control)
    video.crossOrigin = 'anonymous';
    
    video.src = videoSrc;
    video.load(); // 🔥 Force immediate load!
    
    // 🚀 INSTANT: Enable as soon as possible!
    const monitorBuffer = () => {
      // 🔥 Don't wait - enable immediately!
      if (video.readyState >= 1 && isLoading) {
        console.log(`⚡ Metadata ready - INSTANT ENABLE!`);
        setIsLoading(false);
      }
    };
    
    video.addEventListener('progress', monitorBuffer);
    
    return () => {
      video.removeEventListener('progress', monitorBuffer);
    };
  }, [videoSrc]);

  // Handle play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        console.error('Play failed:', err);
        toast.error('Oynatma başarısız', { description: 'Video yüklenmeyi bekleyin' });
      });
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const newTime = clickPercent * duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume
  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    const playerContainer = videoRef.current?.parentElement;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen - use the player container, not just video
      const fullscreenElement = playerContainer || videoRef.current;
      fullscreenElement?.requestFullscreen?.() || 
      fullscreenElement?.webkitRequestFullscreen?.() || 
      fullscreenElement?.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || 
      document.webkitExitFullscreen?.() || 
      document.msExitFullscreen?.();
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Get user-specific storage key
  const getUserStorageKey = (key) => {
    return user?.id ? `${key}_user_${user.id}` : `${key}_guest`;
  };

  // Get watch progress key
  const getWatchProgressKey = () => {
    if (!animeId || !episodeNumber) return null;
    const userPart = user?.id ? `user_${user.id}` : 'guest';
    return `watch_progress_${userPart}_${animeId}_${episodeNumber}`;
  };

  // 🔥 OPTIMIZED: Save progress with better debouncing
  const saveWatchProgress = (currentTime, duration) => {
    if (!animeId || !episodeNumber || duration === 0) return;

    const progress = {
      currentTime: currentTime,
      duration: duration,
      watchedPercentage: (currentTime / duration) * 100,
      lastWatched: new Date().toISOString(),
      animeId: animeId,
      episodeNumber: episodeNumber,
      magnetUri: magnetUri
    };

    const progressKey = getWatchProgressKey();
    if (progressKey) {
      // 🔥 Use requestIdleCallback for non-blocking save
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          localStorage.setItem(progressKey, JSON.stringify(progress));
        });
      } else {
        localStorage.setItem(progressKey, JSON.stringify(progress));
      }
    }
  };

  // Get all user progress for this anime
  const getAllUserProgress = () => {
    if (!user?.id || !animeId) return [];
    
    const allKeys = Object.keys(localStorage);
    const userProgressKeys = allKeys.filter(key => 
      key.startsWith(`watch_progress_user_${user.id}_${animeId}_`)
    );
    
    return userProgressKeys.map(key => {
      try {
        const progress = JSON.parse(localStorage.getItem(key));
        return {
          episodeNumber: progress.episodeNumber,
          watchedPercentage: progress.watchedPercentage,
          lastWatched: progress.lastWatched,
          currentTime: progress.currentTime,
          duration: progress.duration
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean).sort((a, b) => a.episodeNumber - b.episodeNumber);
  };

  // Handle quality change
  const handleQualityChangeLocal = (newQuality) => {
    if (onQualityChange) {
      onQualityChange(newQuality);
    }
    toast.success(`🎥 Kalite: ${newQuality}`);
  };

  // Format time
  const formatTime = (time) => {
    if (isNaN(time) || time === 0) return '0:00';
    
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Save subtitle settings to localStorage (per user)
  useEffect(() => {
    const storageKey = getUserStorageKey('subtitle-settings');
    localStorage.setItem(storageKey, JSON.stringify(subtitleSettings));
  }, [subtitleSettings, user?.id]);

  // Load subtitle settings from localStorage (per user)
  useEffect(() => {
    const storageKey = getUserStorageKey('subtitle-settings');
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const loadedSettings = JSON.parse(saved);
        setSubtitleSettings(loadedSettings);
        console.log('📂 Altyazı ayarları yüklendi:', user?.id ? `Kullanıcı ${user.id}` : 'Misafir');
      } catch (e) {
        console.log('Failed to load subtitle settings:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 🔥 OPTIMIZED: Detect subtitles only once
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const detectSubtitles = () => {
      const textTracks = video.textTracks;
      if (textTracks && textTracks.length > 0) {
        const tracks = [];
        for (let i = 0; i < textTracks.length; i++) {
          const track = textTracks[i];
          tracks.push({
            index: i,
            label: track.label || `Track ${i + 1}`,
            language: track.language || 'unknown',
            kind: track.kind
          });
        }
        setAvailableSubtitles(tracks);
        console.log(`📝 Found ${tracks.length} subtitle track(s):`, tracks);
      }
    };

    // Detect when tracks are loaded (only on metadata)
    video.addEventListener('loadedmetadata', detectSubtitles, { once: true });
    
    return () => {
      video.removeEventListener('loadedmetadata', detectSubtitles);
    };
  }, [videoSrc]);

  // Handle subtitle visibility and track selection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSubtitleVisibility = () => {
      const textTracks = video.textTracks;
      if (textTracks && textTracks.length > 0) {
        for (let i = 0; i < textTracks.length; i++) {
          // Show only selected track if subtitles enabled
          textTracks[i].mode = (subtitlesEnabled && i === selectedSubtitleTrack) ? 'showing' : 'hidden';
        }
        console.log(`📝 Track ${selectedSubtitleTrack}:`, subtitlesEnabled ? 'Showing' : 'Hidden');
      }
    };

    updateSubtitleVisibility();
    const timeoutId = setTimeout(updateSubtitleVisibility, 500);
    
    return () => clearTimeout(timeoutId);
  }, [subtitlesEnabled, selectedSubtitleTrack, videoSrc]);

  return (
    <div 
      className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl group"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => !showSettings && setShowControls(false)}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        preload="auto"
        onClick={togglePlay}
        autoPlay={false}
        playsInline
      >
        {subtitleSrc && (
          <>
            <track
              kind="subtitles"
              src={subtitleSrc}
              srcLang="en"
              label="English"
              default
            />
            <track
              kind="captions"
              src={subtitleSrc}
              srcLang="en"
              label="English CC"
            />
          </>
        )}
        Your browser does not support the video tag.
      </video>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <div className={`${isFullscreen ? 'w-24 h-24 border-6' : 'w-16 h-16 border-4'} border-violet-500 border-t-transparent rounded-full animate-spin mb-4`}></div>
          <div className="text-center text-white px-4">
            <p className={`${isFullscreen ? 'text-xl' : 'text-base'} font-semibold mb-2`}>
              🚀 Video Yüklüyor...
            </p>
            <p className={`${isFullscreen ? 'text-base' : 'text-sm'} text-gray-300 mb-2`}>
              {videoRef.current?.buffered?.length > 0 && videoRef.current.buffered.end(0) > 0
                ? `📊 Buffer: ${((videoRef.current.buffered.end(0) / videoRef.current.duration) * 100).toFixed(1)}%`
                : 'Torrent\'ten indiriliyor...'}
            </p>
            <p className={`${isFullscreen ? 'text-sm' : 'text-xs'} text-yellow-400`}>
              ⚡ Video %38 indi - Yeterli buffer oluşunca otomatik başlar
            </p>
            <p className={`${isFullscreen ? 'text-sm' : 'text-xs'} text-gray-400 mt-2`}>
              💡 İlk yükleme 10-30 saniye sürebilir
            </p>
            <p className={`${isFullscreen ? 'text-sm' : 'text-xs'} text-green-400 mt-1`}>
              ✨ 2. izlemede ANINDA!
            </p>
            <button
              onClick={() => {
                setIsLoading(false);
                toast.info('👍 Loading kapatıldı, play\'e basabilirsiniz');
              }}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm"
            >
              ⚠️ Manuel Devam Et
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center text-white p-6 max-w-md">
            <h3 className="text-xl font-bold mb-2">❌ Video Hatası</h3>
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-violet-600 rounded-lg text-white hover:bg-violet-700"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Play Button (when paused) */}
      {!isPlaying && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <button
            onClick={togglePlay}
            className={`${isFullscreen ? 'w-32 h-32 text-4xl' : 'w-20 h-20 text-2xl'} bg-gradient-to-r from-violet-600 to-purple-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform shadow-2xl`}
          >
            ▶️
          </button>
        </div>
      )}

      {/* Custom Subtitle Overlay */}
      {subtitleSrc && (
        <div 
          className="absolute inset-x-0 pointer-events-none z-10"
          style={{
            bottom: subtitleSettings.position === 'bottom' ? `${subtitleSettings.verticalPosition}px` : 'auto',
            top: subtitleSettings.position === 'top' ? `${subtitleSettings.verticalPosition}px` : 'auto',
          }}
        >
          <div 
            className="text-center px-4"
            style={{
              fontSize: `${subtitleSettings.fontSize}px`,
              fontFamily: subtitleSettings.fontFamily,
              color: subtitleSettings.color,
              textShadow: `2px 2px 4px ${subtitleSettings.outline}`,
              opacity: subtitleSettings.opacity,
              backgroundColor: subtitleSettings.backgroundColor,
              borderRadius: '8px',
              display: 'inline-block',
              maxWidth: '90%',
              margin: '0 auto'
            }}
          >
            {/* Subtitle text will be managed by native track */}
          </div>
        </div>
      )}

      {/* Settings Menu */}
      {showSettings && (
        <div 
          ref={settingsRef}
          className={`absolute ${isFullscreen ? 'top-8 right-8 w-96 max-h-[85vh] p-8' : 'top-4 right-4 w-80 max-h-96 p-6'} bg-black/95 backdrop-blur-md rounded-xl text-white z-30 overflow-y-auto`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-violet-300">⚙️ Video Ayarları</h3>
              <p className="text-xs text-gray-400">
                {user?.username ? `👤 ${user.username}` : '👥 Misafir'}
                {animeId && episodeNumber ? ` | Bölüm ${episodeNumber}` : ''}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* Progress Info */}
          {watchProgress.watchedPercentage > 0 && (
            <div className="mb-4 p-3 bg-violet-900/30 rounded-lg border border-violet-500/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-violet-200">📺 İzleme İlerlemesi</span>
                <span className="text-white font-bold">{Math.round(watchProgress.watchedPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${watchProgress.watchedPercentage}%` }}
                />
              </div>
              {watchProgress.lastWatched && (
                <div className="text-xs text-gray-400 mt-1">
                  Son: {new Date(watchProgress.lastWatched).toLocaleTimeString('tr-TR')}
                </div>
              )}
            </div>
          )}

          {/* Subtitle Settings */}
          <div className="space-y-4">
            <h4 className="font-semibold text-violet-200 border-b border-violet-500/30 pb-2">📝 Altyazı Ayarları</h4>
            
            {/* Subtitle Track Selector */}
            {availableSubtitles.length > 0 && (
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Altyazı Trackı ({availableSubtitles.length} track)
                </label>
                <select
                  value={selectedSubtitleTrack}
                  onChange={(e) => {
                    const newTrack = parseInt(e.target.value);
                    setSelectedSubtitleTrack(newTrack);
                    toast.success(`📝 ${availableSubtitles[newTrack]?.label || 'Track ' + (newTrack + 1)}`, {
                      duration: 1500
                    });
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  {availableSubtitles.map((track, idx) => (
                    <option key={idx} value={idx}>
                      {idx + 1}. {track.label} ({track.language})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  ⚡ MKV'den direkt yüklenir (hızlı!)
                </p>
              </div>
            )}
            
            {/* Font Size */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Yazı Boyutu: {subtitleSettings.fontSize}px</label>
              <input
                type="range"
                min="12"
                max="36"
                value={subtitleSettings.fontSize}
                onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                className="w-full accent-violet-500"
              />
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Yazı Tipi</label>
              <select
                value={subtitleSettings.fontFamily}
                onChange={(e) => setSubtitleSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
              </select>
            </div>

            {/* Text Color */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Yazı Rengi</label>
              <div className="flex gap-2 flex-wrap">
                {['#FFFFFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFA500'].map(color => (
                  <button
                    key={color}
                    onClick={() => setSubtitleSettings(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded border-2 ${
                      subtitleSettings.color === color ? 'border-violet-400' : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={subtitleSettings.color}
                onChange={(e) => setSubtitleSettings(prev => ({ ...prev, color: e.target.value }))}
                className="mt-2 w-full h-8 bg-gray-800 border border-gray-600 rounded"
              />
            </div>

            {/* Background */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Arka Plan</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setSubtitleSettings(prev => ({ ...prev, backgroundColor: 'transparent' }))}
                  className={`px-3 py-1 rounded text-sm ${
                    subtitleSettings.backgroundColor === 'transparent' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Şeffaf
                </button>
                <button
                  onClick={() => setSubtitleSettings(prev => ({ ...prev, backgroundColor: 'rgba(0, 0, 0, 0.7)' }))}
                  className={`px-3 py-1 rounded text-sm ${
                    subtitleSettings.backgroundColor === 'rgba(0, 0, 0, 0.7)' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Siyah
                </button>
                <button
                  onClick={() => setSubtitleSettings(prev => ({ ...prev, backgroundColor: 'rgba(0, 0, 0, 0.9)' }))}
                  className={`px-3 py-1 rounded text-sm ${
                    subtitleSettings.backgroundColor === 'rgba(0, 0, 0, 0.9)' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Koyu
                </button>
              </div>
            </div>

            {/* Outline Color */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Çerçeve Rengi</label>
              <div className="flex gap-2 mb-2">
                {['black', 'white', 'gray', 'transparent'].map(outline => (
                  <button
                    key={outline}
                    onClick={() => setSubtitleSettings(prev => ({ ...prev, outline }))}
                    className={`px-3 py-1 rounded text-sm capitalize ${
                      subtitleSettings.outline === outline 
                        ? 'bg-violet-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {outline === 'transparent' ? 'Yok' : outline}
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Dikey Konum</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSubtitleSettings(prev => ({ ...prev, position: 'top', verticalPosition: 20 }))}
                  className={`px-3 py-1 rounded text-sm ${
                    subtitleSettings.position === 'top' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Üst
                </button>
                <button
                  onClick={() => setSubtitleSettings(prev => ({ ...prev, position: 'bottom', verticalPosition: 80 }))}
                  className={`px-3 py-1 rounded text-sm ${
                    subtitleSettings.position === 'bottom' 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Alt
                </button>
              </div>
              
              {/* Vertical Position Slider */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {subtitleSettings.position === 'bottom' ? 'Alttan' : 'Üstten'} Uzaklık: {subtitleSettings.verticalPosition}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="150"
                  value={subtitleSettings.verticalPosition}
                  onChange={(e) => setSubtitleSettings(prev => ({ ...prev, verticalPosition: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Yakın (10px)</span>
                  <span>Uzak (150px)</span>
                </div>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Şeffaflık: {Math.round(subtitleSettings.opacity * 100)}%</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={subtitleSettings.opacity}
                onChange={(e) => setSubtitleSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                className="w-full accent-violet-500"
              />
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setSubtitleSettings({
                fontSize: 18,
                fontFamily: 'Arial',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                outline: 'black',
                position: 'bottom',
                verticalPosition: 80,
                opacity: 1
              })}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              🔄 Varsayılana Dön
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h4 className="font-semibold text-violet-200 mb-3">⌨️ Kısayollar</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Space</span>
                <span>Oynat/Durdur</span>
              </div>
              <div className="flex justify-between">
                <span>← →</span>
                <span>10sn Geri/İleri</span>
              </div>
              <div className="flex justify-between">
                <span>↑ ↓</span>
                <span>Ses +/-</span>
              </div>
              <div className="flex justify-between">
                <span>F</span>
                <span>Tam Ekran</span>
              </div>
              <div className="flex justify-between">
                <span>M</span>
                <span>Sessiz</span>
              </div>
              <div className="flex justify-between">
                <span>, .</span>
                <span>Hız -/+</span>
              </div>
              <div className="flex justify-between">
                <span>0-9</span>
                <span>% Konuma Git</span>
              </div>
              <div className="flex justify-between">
                <span>C</span>
                <span className="font-bold text-yellow-300">Altyazı Aç/Kapat</span>
              </div>
              <div className="flex justify-between">
                <span>S</span>
                <span>Ayarlar Menüsü</span>
              </div>
              <div className="flex justify-between">
                <span>J/K</span>
                <span>Altyazı Yukarı/Aşağı</span>
              </div>
            </div>

            {/* User Progress Summary */}
            {user?.id && animeId && getAllUserProgress().length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-700">
                <h5 className="text-sm font-medium text-violet-200 mb-2">📊 Bu Anime'deki İlerlemeniz</h5>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {getAllUserProgress().slice(0, 5).map(progress => (
                    <div key={progress.episodeNumber} className="flex justify-between text-xs">
                      <span className="text-gray-400">Bölüm {progress.episodeNumber}</span>
                      <span className={`font-medium ${
                        progress.watchedPercentage > 90 ? 'text-green-400' :
                        progress.watchedPercentage > 50 ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}>
                        {Math.round(progress.watchedPercentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent ${isFullscreen ? 'p-8' : 'p-4'} transition-opacity duration-300 z-10 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className={`${isFullscreen ? 'mb-6' : 'mb-4'}`}>
          <div 
            className={`w-full ${isFullscreen ? 'h-3' : 'h-2'} bg-white/20 rounded-full cursor-pointer relative`}
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${isFullscreen ? 'gap-6' : 'gap-4'}`}>
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className={`text-white ${isFullscreen ? 'text-3xl p-3' : 'text-2xl p-2'} hover:text-violet-300 transition-colors hover:bg-white/10 rounded`}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Previous/Next 10s */}
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = Math.max(0, video.currentTime - 10);
                  toast('⏪ 10 saniye geri', { duration: 1000 });
                }
              }}
              className={`text-white ${isFullscreen ? 'text-xl p-2' : 'text-lg p-1'} hover:text-violet-300 transition-colors hover:bg-white/10 rounded`}
            >
              ⏪
            </button>
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = Math.min(video.duration, video.currentTime + 10);
                  toast('⏩ 10 saniye ileri', { duration: 1000 });
                }
              }}
              className={`text-white ${isFullscreen ? 'text-xl p-2' : 'text-lg p-1'} hover:text-violet-300 transition-colors hover:bg-white/10 rounded`}
            >
              ⏩
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.muted = !video.muted;
                    toast(video.muted ? '🔇 Sessiz' : '🔊 Ses açık', { duration: 1000 });
                  }
                }}
                className={`text-white ${isFullscreen ? 'text-xl' : 'text-lg'} hover:text-violet-300 transition-colors`}
              >
                {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className={`${isFullscreen ? 'w-28' : 'w-20'} accent-violet-500`}
              />
              <span className={`text-white ${isFullscreen ? 'text-sm w-10' : 'text-xs w-8'}`}>{Math.round(volume * 100)}%</span>
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    const newRate = Math.max(0.25, video.playbackRate - 0.25);
                    video.playbackRate = newRate;
                    setPlaybackRate(newRate);
                    toast(`🐌 Hız: ${newRate}x`, { duration: 1000 });
                  }
                }}
                className="text-white text-sm hover:text-violet-300 transition-colors px-1 py-1 hover:bg-white/10 rounded"
              >
                🐌
              </button>
              <span className={`text-white ${isFullscreen ? 'text-sm px-3 min-w-[40px]' : 'text-xs px-2 min-w-[32px]'} text-center`}>{playbackRate}x</span>
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    const newRate = Math.min(2, video.playbackRate + 0.25);
                    video.playbackRate = newRate;
                    setPlaybackRate(newRate);
                    toast(`🐇 Hız: ${newRate}x`, { duration: 1000 });
                  }
                }}
                className="text-white text-sm hover:text-violet-300 transition-colors px-1 py-1 hover:bg-white/10 rounded"
              >
                🐇
              </button>
            </div>

            {/* Time */}
            <div className={`text-white ${isFullscreen ? 'text-base' : 'text-sm'} font-mono`}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className={`flex items-center ${isFullscreen ? 'gap-6' : 'gap-4'}`}>
            {/* Quality Selector */}
            {availableQualities.length > 1 && (
              <select 
                value={quality} 
                onChange={(e) => handleQualityChangeLocal(e.target.value)}
                className={`bg-black/80 text-white border border-violet-500/50 rounded ${isFullscreen ? 'px-3 py-2 text-base' : 'px-2 py-1 text-sm'}`}
              >
                {availableQualities.map(q => (
                  <option key={q} value={q} className="bg-gray-800">
                    {q}
                  </option>
                ))}
              </select>
            )}

            {/* Subtitle Toggle */}
            {subtitleSrc && (
              <button
                onClick={() => {
                  setSubtitlesEnabled(!subtitlesEnabled);
                  toast(!subtitlesEnabled ? '📝 Altyazı açıldı' : '🚫 Altyazı kapatıldı', { duration: 1000 });
                }}
                className={`text-white ${isFullscreen ? 'text-xl' : 'text-lg'} hover:text-violet-300 transition-colors ${
                  subtitlesEnabled ? 'text-white' : 'text-gray-500'
                }`}
                title={subtitlesEnabled ? 'Altyazıyı Kapat (C)' : 'Altyazıyı Aç (C)'}
              >
                📝
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-white ${isFullscreen ? 'text-xl' : 'text-lg'} hover:text-violet-300 transition-colors ${
                showSettings ? 'text-violet-400' : ''
              }`}
            >
              ⚙️
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className={`text-white ${isFullscreen ? 'text-xl' : 'text-lg'} hover:text-violet-300 transition-colors`}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>
          </div>
        </div>
      </div>

      {/* Quality Badge */}
      {upscaleAvailable && (
        <div className={`absolute ${isFullscreen ? 'top-8 left-8' : 'top-4 left-4'} z-10`}>
          <div className={`${isFullscreen ? 'px-4 py-3 text-lg' : 'px-3 py-2 text-sm'} rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg`}>
            {quality === '4K' ? '⚡ 4K Upscale' : quality}
          </div>
        </div>
      )}

      {/* Custom Subtitle Styles */}
      <style>{`
        video::cue {
          font-size: ${subtitleSettings.fontSize * (isFullscreen ? 1.4 : 1)}px !important;
          font-family: ${subtitleSettings.fontFamily} !important;
          color: ${subtitleSettings.color} !important;
          background-color: ${subtitleSettings.backgroundColor} !important;
          text-shadow: ${isFullscreen ? '3px 3px 6px' : '2px 2px 4px'} ${subtitleSettings.outline} !important;
          opacity: ${subtitleSettings.opacity} !important;
          border-radius: ${isFullscreen ? '6px' : '4px'} !important;
          padding: ${isFullscreen ? '4px 12px' : '2px 8px'} !important;
          line-height: 1.4 !important;
        }
        
        video::-webkit-media-text-track-display {
          ${subtitleSettings.position === 'top' ? `top: ${subtitleSettings.verticalPosition * (isFullscreen ? 1.5 : 1)}px !important; bottom: auto !important;` : `bottom: ${subtitleSettings.verticalPosition * (isFullscreen ? 1.5 : 1)}px !important; top: auto !important;`}
          text-align: center !important;
        }
        
        video::-webkit-media-text-track-container {
          ${subtitleSettings.position === 'top' ? `top: ${subtitleSettings.verticalPosition * (isFullscreen ? 1.5 : 1)}px !important; bottom: auto !important;` : `bottom: ${subtitleSettings.verticalPosition * (isFullscreen ? 1.5 : 1)}px !important; top: auto !important;`}
          font-size: ${subtitleSettings.fontSize * (isFullscreen ? 1.4 : 1)}px !important;
          font-family: ${subtitleSettings.fontFamily} !important;
          text-align: center !important;
          width: 100% !important;
        }
        
        /* Firefox subtitle styling */
        video::cue(.subtitle) {
          font-size: ${subtitleSettings.fontSize * (isFullscreen ? 1.4 : 1)}px !important;
          font-family: ${subtitleSettings.fontFamily} !important;
          color: ${subtitleSettings.color} !important;
          background-color: ${subtitleSettings.backgroundColor} !important;
          text-shadow: ${isFullscreen ? '3px 3px 6px' : '2px 2px 4px'} ${subtitleSettings.outline} !important;
        }
        
        /* Tam ekran modunda genel stillemeler */
        .group:fullscreen,
        .group:-webkit-full-screen,
        .group:-moz-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0 !important;
        }
        
        .group:fullscreen video,
        .group:-webkit-full-screen video,
        .group:-moz-full-screen video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: contain !important;
        }
      `}</style>
    </div>
  );
}