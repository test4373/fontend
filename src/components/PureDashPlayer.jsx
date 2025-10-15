import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function PureDashPlayer({ 
  videoSrc, 
  subtitleSrc,
  magnet,
  filename,
  onTimeUpdate, 
  initialTime = 0,
  quality = '1080p',
  onQualityChange,
  upscaleAvailable = false,
  originalVideoSrc = null,
  availableQualities = ['480p', '720p', '1080p', '4K'],
  availableSubtitles = [],
  availableAudioTracks = [],
  onSubtitleChange,
  onAudioChange,
  isHls = false,
  onDashError
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(quality);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const settingsRef = useRef(null);
  const qualityMenuRef = useRef(null);
  const subtitleMenuRef = useRef(null);
  const audioMenuRef = useRef(null);

  // 🚀 Initialize Video.js Player with enhanced audio support
  useEffect(() => {
    if (!videoRef.current || !videoSrc) return;

    console.log('🚀 Initializing Video.js player...');
    console.log('📼 Video source:', videoSrc);

    // Determine if it's a DASH manifest (.mpd) or HLS (.m3u8)
    const isDashSource = videoSrc.endsWith('.mpd');
    const isHlsSource = videoSrc.endsWith('.m3u8') || isHls;

    // Video.js configuration with enhanced stability and anti-freeze
    const videoJsOptions = {
      controls: false, // We'll use custom controls
      responsive: true,
      fluid: true,
      preload: 'metadata',
      playsinline: true,
      crossorigin: 'anonymous',
      sources: [{
        src: videoSrc,
        type: isDashSource ? 'application/dash+xml' : 
              isHlsSource ? 'application/x-mpegURL' : 
              'video/mp4'
      }],
      tracks: availableSubtitles.map((sub, index) => ({
        kind: 'subtitles',
        src: sub.src + '?t=' + Date.now(), // Cache busting
        srclang: sub.lang || 'en',
        label: sub.label || `Subtitle ${index + 1}`,
        default: sub.default || index === 0
      })),
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: !isDashSource,
          // Enhanced audio support
          allowSeeksWithinUnsafeLiveWindow: true,
          liveTolerance: 15,
          liveRangeSafeTimeDelta: 15,
          // Anti-freeze settings
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          maxBufferSize: 60 * 1000 * 1000, // 60MB
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 10,
          backBufferLength: 30,
          // Better retry settings
          maxPlaylistRetries: 3,
          playlistLoadTimeout: 10000,
          manifestLoadTimeout: 10000
        },
        // Enhanced audio configuration
        audioTracks: availableAudioTracks.map((audio, index) => ({
          id: `audio-${index}`,
          kind: 'main',
          label: audio.label || `Audio ${index + 1}`,
          language: audio.lang || 'en',
          enabled: index === 0 // Enable first track by default
        })),
        // Enhanced HTML5 video settings for better audio/subtitle support
        nativeVideoTracks: true,
        nativeAudioTracks: true,
        nativeTextTracks: true
      },
      // Additional audio enhancement options
      audioOnlyMode: false,
      audioPosterMode: false,
      // Better error handling
      errorDisplay: false, // We handle errors ourselves
      // Enhanced buffering
      liveui: false,
      // Better subtitle support
      textTrackSettings: {
        persistTextTrackSettings: true
      }
    };

    // Create Video.js player
    const player = videojs(videoRef.current, videoJsOptions, () => {
      console.log('✅ Video.js player ready');
      setIsReady(true);
      setError(null);
      playerRef.current = player;

      // Jump to saved position
      if (initialTime > 5) {
        player.currentTime(initialTime);
        console.log('⏩ Jumped to:', initialTime, 's');
        toast.info(`⏩ ${Math.floor(initialTime / 60)}:${String(Math.floor(initialTime % 60)).padStart(2, '0')}`, { duration: 2000 });
      }

      // Auto-play on ready
      player.play().catch(err => {
        console.log('Auto-play prevented:', err.message);
        toast.info('🎬 Tıklayarak başlatın', { duration: 3000 });
      });
    });

    // Enhanced subtitle handling with better detection
    const enableSubtitles = () => {
      try {
        const tracks = player.textTracks();
        console.log('📝 Total text tracks:', tracks ? tracks.length : 0);
        
        if (tracks && tracks.length > 0) {
          // Wait a bit for tracks to fully load
          setTimeout(() => {
            let enabledCount = 0;
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              if (track && (track.kind === 'subtitles' || track.kind === 'captions')) {
                console.log(`Track ${i}:`, {
                  kind: track.kind,
                  language: track.language,
                  label: track.label,
                  mode: track.mode,
                  readyState: track.readyState
                });
                
                // Enable first subtitle track
                if (enabledCount === 0) {
                  track.mode = 'showing';
                  setCurrentSubtitle(availableSubtitles[i] || null);
                  console.log('✅ First subtitle enabled:', track.label);
                  enabledCount++;
                } else {
                  track.mode = 'disabled';
                  console.log('❌ Disabled duplicate track:', track.label);
                }
              }
            }
            
            // Force enable if no tracks were enabled
            if (enabledCount === 0 && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (track && (track.kind === 'subtitles' || track.kind === 'captions')) {
                  track.mode = 'showing';
                  setCurrentSubtitle(availableSubtitles[i] || null);
                  console.log('🔄 Force enabled subtitle:', track.label);
                  break;
                }
              }
            }
          }, 500);
        }
      } catch (error) {
        console.log('⚠️ Subtitle handling error:', error.message);
      }
    };

    // Event handlers
    player.on('loadedmetadata', () => {
      setDuration(player.duration() || 0);
      console.log('📊 Duration:', Math.floor(player.duration() / 60) + 'm');
      enableSubtitles();
    });

    // Additional subtitle enable on loadeddata
    player.on('loadeddata', () => {
      console.log('📥 Video data loaded, enabling subtitles...');
      enableSubtitles();
    });

    // Force enable subtitles after a delay
    player.on('canplay', () => {
      console.log('✅ Video can play, final subtitle check...');
      setTimeout(() => {
        enableSubtitles();
      }, 1000);
    });

    // Enhanced freeze detection and recovery
    let lastVideoTime = 0;
    let lastAudioTime = 0;
    let freezeDetectionCount = 0;
    let recoveryAttempts = 0;
    const MAX_RECOVERY_ATTEMPTS = 3;

    player.on('timeupdate', () => {
      const time = player.currentTime();
      setCurrentTime(time);
      
      // Freeze detection
      const videoElement = player.el().querySelector('video');
      if (videoElement) {
        const videoTime = videoElement.currentTime;
        const audioTime = time;
        
        // Detect if video is frozen but audio continues
        if (Math.abs(videoTime - lastVideoTime) < 0.1 && Math.abs(audioTime - lastAudioTime) > 0.5) {
          freezeDetectionCount++;
          console.warn(`⚠️ Video freeze detected (${freezeDetectionCount}/3) - video: ${videoTime.toFixed(2)}s, audio: ${audioTime.toFixed(2)}s`);
          
          // Only attempt recovery if we haven't tried too many times
          if (freezeDetectionCount >= 3 && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            recoveryAttempts++;
            console.log(`🔄 Attempting recovery #${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);
            
            // Try multiple recovery strategies
            if (recoveryAttempts === 1) {
              // Strategy 1: Seek slightly back
              const seekTime = Math.max(0, time - 0.5);
              player.currentTime(seekTime);
              console.log('🔄 Recovery: Seeking back to', seekTime.toFixed(2), 's');
            } else if (recoveryAttempts === 2) {
              // Strategy 2: Force reload
              const currentSrc = player.currentSrc();
              player.src(currentSrc);
              player.load();
              player.currentTime(time);
              console.log('🔄 Recovery: Reloading video source');
            } else if (recoveryAttempts === 3) {
              // Strategy 3: Reset player
              player.pause();
              setTimeout(() => {
                player.currentTime(time);
                player.play().catch(err => console.log('Recovery play failed:', err));
                console.log('🔄 Recovery: Reset and resume');
              }, 100);
            }
            
            freezeDetectionCount = 0; // Reset counter
          }
        } else {
          // Video is playing normally, reset counters
          freezeDetectionCount = 0;
          recoveryAttempts = 0;
        }
        
        lastVideoTime = videoTime;
        lastAudioTime = audioTime;
      }
      
      if (onTimeUpdate) {
        onTimeUpdate(time, player.duration() || 0);
      }
    });

    // Enhanced seek handling
    player.on('seeking', () => {
      const seekTime = player.currentTime();
      console.log('🎯 Seeking to:', seekTime.toFixed(2), 's');
    });

    player.on('seeked', () => {
      const seekTime = player.currentTime();
      console.log('✅ Seeked to:', seekTime.toFixed(2), 's');
    });

    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('waiting', () => setBuffering(true));
    player.on('canplay', () => setBuffering(false));
    player.on('playing', () => setBuffering(false));

    player.on('volumechange', () => {
      setVolume(player.volume());
      setIsMuted(player.muted());
    });

    player.on('ratechange', () => {
      setPlaybackRate(player.playbackRate());
    });

    player.on('error', (e) => {
      const error = player.error();
      console.error('❌ Video.js error:', error);
      
      // Enhanced error recovery
      if (error && error.code) {
        switch (error.code) {
          case 1: // MEDIA_ERR_ABORTED
            console.log('🔄 Media aborted - attempting recovery');
            toast.warning('🔄 Video kesildi, kurtarılıyor...', { duration: 2000 });
            setTimeout(() => {
              try {
                const currentSrc = player.currentSrc();
                const currentTime = player.currentTime();
                player.src(currentSrc);
                player.load();
                player.currentTime(currentTime);
                player.play().catch(err => console.log('Recovery play failed:', err));
                setError(null);
              } catch (err) {
                console.error('Recovery failed:', err);
                setError('Kurtarma başarısız');
                toast.error('❌ Kurtarma başarısız');
              }
            }, 1000);
            break;
          case 2: // MEDIA_ERR_NETWORK
            console.log('🔄 Network error - attempting recovery');
            toast.error('🌐 Ağ hatası, yeniden deneniyor...', { duration: 3000 });
            setTimeout(() => {
              try {
                const currentSrc = player.currentSrc();
                const currentTime = player.currentTime();
                player.src(currentSrc + '?retry=' + Date.now());
                player.load();
                player.currentTime(currentTime);
                player.play().catch(err => console.log('Recovery play failed:', err));
                setError(null);
              } catch (err) {
                console.error('Recovery failed:', err);
                setError('Ağ hatası devam ediyor');
                toast.error('❌ Ağ hatası devam ediyor');
              }
            }, 2000);
            break;
          case 3: // MEDIA_ERR_DECODE
            console.log('🔄 Decode error - attempting recovery');
            toast.error('🎬 Video kodek hatası, yeniden deneniyor...', { duration: 3000 });
            setTimeout(() => {
              try {
                // Try transcoding endpoint if available
                const currentSrc = player.currentSrc();
                if (currentSrc.includes('/streamfile/')) {
                  const transcodingSrc = currentSrc.replace('/streamfile/', '/streamfile-transcode/');
                  player.src(transcodingSrc);
                  player.load();
                  toast.info('🔄 Kodek dönüştürme deneniyor...', { duration: 2000 });
                } else {
                  player.src(currentSrc);
                  player.load();
                }
                player.play().catch(err => console.log('Recovery play failed:', err));
                setError(null);
              } catch (err) {
                console.error('Recovery failed:', err);
                setError('Kodek hatası devam ediyor');
                toast.error('❌ Kodek hatası devam ediyor');
              }
            }, 2000);
            break;
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            console.log('❌ Source not supported');
            setError('Video formatı desteklenmiyor');
            toast.error('❌ Video formatı desteklenmiyor', { duration: 5000 });
            break;
          default:
            console.log('🔄 Unknown error - attempting recovery');
            toast.warning('🔄 Bilinmeyen hata, kurtarılıyor...', { duration: 2000 });
            setTimeout(() => {
              try {
                const currentSrc = player.currentSrc();
                const currentTime = player.currentTime();
                player.src(currentSrc);
                player.load();
                player.currentTime(currentTime);
                player.play().catch(err => console.log('Recovery play failed:', err));
                setError(null);
              } catch (err) {
                console.error('Recovery failed:', err);
                setError('Video oynatılamıyor');
                toast.error('❌ Video oynatılamıyor');
              }
            }, 1000);
        }
      } else {
        console.log('🔄 No error code - attempting general recovery');
        toast.warning('🔄 Video hatası, kurtarılıyor...', { duration: 2000 });
        setTimeout(() => {
          try {
            const currentSrc = player.currentSrc();
            const currentTime = player.currentTime();
            player.src(currentSrc);
            player.load();
            player.currentTime(currentTime);
            player.play().catch(err => console.log('Recovery play failed:', err));
            setError(null);
          } catch (err) {
            console.error('Recovery failed:', err);
            setError('Video oynatılamıyor');
            toast.error('❌ Video oynatılamıyor');
          }
        }, 1000);
      }
      
      if (onDashError) onDashError(error);
    });

    player.on('fullscreenchange', () => {
      setIsFullscreen(player.isFullscreen());
    });

    // Enhanced audio track detection
    player.on('loadeddata', () => {
      console.log('📥 Video loaded, checking audio tracks...');
      const audioTracks = player.audioTracks();
      console.log('🔊 Detected audio tracks:', audioTracks.length);
      
      // Enable first audio track if available
      if (audioTracks.length > 0 && !currentAudio) {
        const firstTrack = audioTracks[0];
        firstTrack.enabled = true;
        setCurrentAudio({
          label: firstTrack.label || 'Default Audio',
          lang: firstTrack.language || 'en',
          codec: 'Unknown'
        });
        console.log('✅ First audio track enabled:', firstTrack.label);
      }
    });

    // Audio track change events
    player.on('audiotrackchange', () => {
      const audioTracks = player.audioTracks();
      for (let i = 0; i < audioTracks.length; i++) {
        if (audioTracks[i].enabled) {
          setCurrentAudio({
            label: audioTracks[i].label || `Audio ${i + 1}`,
            lang: audioTracks[i].language || 'en',
            codec: 'Unknown'
          });
          console.log('🔄 Audio track changed to:', audioTracks[i].label);
          break;
        }
      }
    });

    // Cleanup
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        console.log('🧹 Video.js player cleaned up');
      }
    };
  }, [videoSrc, initialTime, availableSubtitles]);

  // Video.js handles all events internally, no need for manual event listeners

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setShowQualityMenu(false);
      }
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target)) {
        setShowSubtitleMenu(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) {
        setShowAudioMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ⌨️ Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const player = playerRef.current;
      if (!player) return;

      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (player.paused()) player.play();
          else player.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.currentTime(Math.max(0, player.currentTime() - 10));
          toast.info('⏪ -10s', { duration: 500 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 10));
          toast.info('⏩ +10s', { duration: 500 });
          break;
        case 'ArrowUp':
          e.preventDefault();
          player.volume(Math.min(1, player.volume() + 0.1));
          toast.info(`🔊 ${Math.round(player.volume() * 100)}%`, { duration: 500 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          player.volume(Math.max(0, player.volume() - 0.1));
          toast.info(`🔉 ${Math.round(player.volume() * 100)}%`, { duration: 500 });
          break;
        case 'KeyM':
          e.preventDefault();
          player.muted(!player.muted());
          toast.info(player.muted() ? '🔇 Sessiz' : '🔊 Ses Açık', { duration: 500 });
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyS':
          e.preventDefault();
          setShowSettings(!showSettings);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSettings]);

  const toggleFullscreen = () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.isFullscreen()) {
      player.exitFullscreen();
    } else {
      player.requestFullscreen();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const player = playerRef.current;
    if (!player) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const dur = player.duration() || 0;
    if (dur > 0) {
      const seekTime = Math.max(0, Math.min(dur - 0.05, pos * dur));
      console.log('🎯 User seeking to:', seekTime.toFixed(2), 's');
      player.currentTime(seekTime);
      toast.info(`⏩ ${Math.floor(seekTime / 60)}:${String(Math.floor(seekTime % 60)).padStart(2, '0')}`, { duration: 1000 });
    }
  };

  const handlePlaybackRateChange = (rate) => {
    const player = playerRef.current;
    if (!player) return;
    
    player.playbackRate(rate);
    setPlaybackRate(rate);
    toast.success(`⚡ Hız: ${rate}x`, { duration: 1000 });
  };

  const handleSubtitleChange = (subtitle) => {
    const player = playerRef.current;
    if (!player) return;

    // Disable all subtitle tracks
    const tracks = player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = 'disabled';
    }

    if (subtitle) {
      // Enable selected subtitle
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === subtitle.label) {
          tracks[i].mode = 'showing';
          setCurrentSubtitle(subtitle);
          console.log('✅ Subtitle activated:', subtitle.label);
          toast.success(`📝 ${subtitle.label}`, { duration: 1000 });
          break;
        }
      }
    } else {
      setCurrentSubtitle(null);
      toast.info('📝 Altyazı Kapalı', { duration: 1000 });
    }
    
    setShowSubtitleMenu(false);
  };

  const handleAudioChange = (audio) => {
    const player = playerRef.current;
    if (!player) return;

    // Enhanced audio track switching for Video.js
    try {
      const audioTracks = player.audioTracks();
      console.log('🔊 Available audio tracks:', audioTracks.length);
      
      // Find and enable the selected audio track
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        if (track.label === audio.label) {
          track.enabled = true;
          setCurrentAudio(audio);
          console.log('✅ Audio track enabled:', audio.label);
          toast.success(`🔊 ${audio.label}`, { duration: 1000 });
          break;
        } else {
          track.enabled = false;
        }
      }
      
      // If no matching track found, try to switch using Video.js methods
      if (!currentAudio || currentAudio.label !== audio.label) {
        // For HLS/DASH sources, try to switch quality/audio
        if (player.tech_ && player.tech_.hls) {
          const hls = player.tech_.hls;
          if (hls.audioTracks) {
            const tracks = hls.audioTracks;
            for (let i = 0; i < tracks.length; i++) {
              if (tracks[i].name === audio.label) {
                hls.audioTrack = i;
                setCurrentAudio(audio);
                toast.success(`🔊 ${audio.label}`, { duration: 1000 });
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Audio track switching failed:', error);
      // Fallback: just update UI state
      setCurrentAudio(audio);
      toast.info(`🔊 ${audio.label} (UI only)`, { duration: 1000 });
    }
    
    setShowAudioMenu(false);
  };

  const handleQualitySelect = (selectedQuality) => {
    setCurrentQuality(selectedQuality);
    if (onQualityChange) onQualityChange(selectedQuality);
    toast.success(`🎥 Kalite: ${selectedQuality}`, { duration: 1000 });
    setShowQualityMenu(false);
  };

  return (
    <div className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        className="video-js vjs-default-skin w-full h-full"
        data-setup="{}"
        playsInline
        crossOrigin="anonymous"
        preload="auto"
      />

      {/* Buffering Spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-violet-500"></div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center text-white p-6 max-w-md">
            <h3 className="text-xl font-bold mb-2">❌ Video Hatası</h3>
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-violet-600 rounded-lg hover:bg-violet-700"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-4 z-10">
        {/* Progress Bar */}
        <div 
          className="w-full h-1 bg-gray-600 rounded-full cursor-pointer mb-3 hover:h-2 transition-all group"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-violet-500 rounded-full relative group-hover:bg-violet-400 transition-colors"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-violet-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player) {
                  if (isPlaying) player.pause();
                  else player.play();
                }
              }}
              className="text-2xl hover:text-violet-400 transition p-2 hover:bg-white/10 rounded-lg"
              title="Oynat/Duraklat (Space)"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Skip Back */}
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player) {
                  player.currentTime(Math.max(0, player.currentTime() - 10));
                }
              }}
              className="text-lg hover:text-violet-400 transition p-2 hover:bg-white/10 rounded-lg"
              title="10s Geri (←)"
            >
              ⏪
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player) {
                  player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 10));
                }
              }}
              className="text-lg hover:text-violet-400 transition p-2 hover:bg-white/10 rounded-lg"
              title="10s İleri (→)"
            >
              ⏩
            </button>

            {/* Time */}
            <span className="text-sm font-medium bg-black/40 px-3 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume */}
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player) {
                  player.muted(!isMuted);
                }
              }}
              className="text-xl hover:text-violet-400 transition p-2 hover:bg-white/10 rounded-lg"
              title="Sessiz (M)"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Quality Menu */}
            <div className="relative" ref={qualityMenuRef}>
              <button
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSettings(false);
                  setShowSubtitleMenu(false);
                  setShowAudioMenu(false);
                }}
                className="text-sm hover:text-violet-400 transition px-3 py-2 hover:bg-white/10 rounded-lg font-medium flex items-center gap-1"
                title="Kalite Seçimi"
              >
                🎥 {currentQuality}
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-2 min-w-[140px] shadow-2xl">
                  <div className="text-xs text-gray-400 mb-2 font-bold px-2">🎥 KALİTE</div>
                  <div className="space-y-1">
                    {availableQualities.map((qual) => (
                      <button
                        key={qual}
                        onClick={() => handleQualitySelect(qual)}
                        className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                          currentQuality === qual
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                      >
                        {qual === '4K' ? '⚡ 4K Ultra HD' : qual}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subtitle Menu */}
            {/* Subtitle Menu - Always show if subtitles available */}
            {availableSubtitles.length > 0 && (
              <div className="relative" ref={subtitleMenuRef}>
                <button
                  onClick={() => {
                    setShowSubtitleMenu(!showSubtitleMenu);
                    setShowSettings(false);
                    setShowQualityMenu(false);
                    setShowAudioMenu(false);
                  }}
                  className="text-sm hover:text-violet-400 transition px-3 py-2 hover:bg-white/10 rounded-lg font-medium flex items-center gap-1"
                  title="Altyazı Seçimi"
                >
                  📝 {currentSubtitle ? currentSubtitle.label.split(' ')[0] : availableSubtitles[0]?.label.split(' ')[0] || 'Kapalı'}
                </button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-2 min-w-[200px] max-w-[300px] shadow-2xl">
                    <div className="text-xs text-gray-400 mb-2 font-bold px-2 flex items-center justify-between">
                      <span>📝 ALTYAZI</span>
                      <span className="text-violet-400">{availableSubtitles.length} track</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      <button
                        onClick={() => handleSubtitleChange(null)}
                        className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                          !currentSubtitle
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                      >
                        ❌ Altyazı Yok
                      </button>
                      {availableSubtitles.map((sub, index) => (
                        <button
                          key={index}
                          onClick={() => handleSubtitleChange(sub)}
                          className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                            currentSubtitle?.label === sub.label
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-gray-300'
                          }`}
                          title={sub.label}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{sub.label}</span>
                            {sub.default && <span className="ml-2 text-[10px] bg-green-600 px-1 rounded">DEFAULT</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audio/Dublaj Menu - Always show if audio tracks available */}
            {availableAudioTracks.length > 1 && (
              <div className="relative" ref={audioMenuRef}>
                <button
                  onClick={() => {
                    setShowAudioMenu(!showAudioMenu);
                    setShowSettings(false);
                    setShowQualityMenu(false);
                    setShowSubtitleMenu(false);
                  }}
                  className="text-sm hover:text-violet-400 transition px-3 py-2 hover:bg-white/10 rounded-lg font-medium flex items-center gap-1"
                  title="Ses/Dublaj Seçimi"
                >
                  🔊 {currentAudio ? currentAudio.label.split(' ')[0] : 'Varsayılan'}
                </button>

                {showAudioMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-2 min-w-[200px] max-w-[300px] shadow-2xl">
                    <div className="text-xs text-gray-400 mb-2 font-bold px-2 flex items-center justify-between">
                      <span>🔊 SES/DUBLAJ</span>
                      <span className="text-violet-400">{availableAudioTracks.length} track</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      {availableAudioTracks.map((audio, index) => (
                        <button
                          key={index}
                          onClick={() => handleAudioChange(audio)}
                          className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                            currentAudio?.label === audio.label
                              ? 'bg-violet-600 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-gray-300'
                          }`}
                          title={audio.label}
                        >
                          <div className="flex flex-col">
                            <span className="truncate">{audio.label}</span>
                            {audio.codec && (
                              <span className="text-[10px] text-gray-400 mt-0.5">
                                Codec: {audio.codec.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Playback Speed */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowQualityMenu(false);
                  setShowSubtitleMenu(false);
                  setShowAudioMenu(false);
                }}
                className="text-sm hover:text-violet-400 transition px-3 py-2 hover:bg-white/10 rounded-lg font-medium"
                title="Hız Ayarları (S)"
              >
                ⚡ {playbackRate}x
              </button>

              {showSettings && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-3 min-w-[240px] shadow-2xl">
                  <div className="text-xs text-gray-400 mb-2 font-bold">⚡ OYNATMA HIZI</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => {
                          handlePlaybackRateChange(rate);
                          setShowSettings(false);
                        }}
                        className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                          playbackRate === rate
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-xl hover:text-violet-400 transition p-2 hover:bg-white/10 rounded-lg"
              title="Tam Ekran (F)"
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>
        </div>
      </div>

      {/* Player Badge */}
      {isReady && !error && (
        <div className="absolute top-4 right-4 z-10">
          <div className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md text-green-400 text-xs font-bold border border-green-500/30">
            🎬 Video.js Enhanced
          </div>
        </div>
      )}

      {/* Quality Badge */}
      {upscaleAvailable && (
        <div className="absolute top-4 left-4 z-10">
          <div className="px-3 py-2 rounded-full bg-violet-600 text-white text-sm font-bold">
            {currentQuality === '4K' ? '⚡ 4K' : currentQuality}
          </div>
        </div>
      )}
    </div>
  );
}
