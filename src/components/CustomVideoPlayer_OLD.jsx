import { useRef, useState, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerLoudIcon, 
  SpeakerOffIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon
} from '@radix-ui/react-icons';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { useTranslation } from 'react-i18next';

// Backend URL - Full local backend
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:64621';

export default function CustomVideoPlayer({ 
  videoSrc, 
  subtitleSrc, 
  onTimeUpdate, 
  initialTime = 0,
  quality = '1080p',
  onQualityChange,
  upscaleAvailable = false,
  originalVideoSrc = null // 1080p orijinal video (ses için)
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null); // Ana video (4K veya 1080p)
  const audioRef = useRef(null); // Ses kaynağı (her zaman 1080p)
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const hlsRef = useRef(null); // HLS.js instance
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState(quality);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); // BİRLEŞİK MENÜ
  
  // 💾 Load subtitle enabled state from localStorage
  const getInitialSubtitleState = () => {
    try {
      const saved = localStorage.getItem('zenshin_subtitles_enabled');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load subtitle state:', err);
    }
    return true; // Default: enabled
  };
  
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(getInitialSubtitleState);
  const subtitlesEnabledRef = useRef(subtitlesEnabled); // 🔥 Use ref for protection interval
  const [useExternalAudio, setUseExternalAudio] = useState(false);
  
  // 💾 Save subtitle enabled state whenever it changes
  useEffect(() => {
    subtitlesEnabledRef.current = subtitlesEnabled; // 🔥 Update ref
    try {
      localStorage.setItem('zenshin_subtitles_enabled', JSON.stringify(subtitlesEnabled));
      console.log('💾 Subtitle state saved:', subtitlesEnabled);
    } catch (err) {
      console.warn('⚠️ Failed to save subtitle state:', err);
    }
  }, [subtitlesEnabled]);

  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [currentSubtitleId, setCurrentSubtitleId] = useState(0);
  const [showSubtitleLanguageMenu, setShowSubtitleLanguageMenu] = useState(false);
  const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [showAudioTrackMenu, setShowAudioTrackMenu] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [subtitlesReady, setSubtitlesReady] = useState(false); // 🔥 Altyazı hazır mı?
  const [waitingForSubtitle, setWaitingForSubtitle] = useState(false);
  // 💾 Load subtitle settings from localStorage or use defaults
  const getInitialSrtSettings = () => {
    try {
      const saved = localStorage.getItem('zenshin_subtitle_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('💾 Loaded subtitle settings from storage');
        return parsed;
      }
    } catch (err) {
      console.warn('⚠️ Failed to load subtitle settings:', err);
    }
    
    // Default settings
    return {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      fontFamily: 'Arial',
      strokeWidth: 2,
      shadowBlur: 4,
      bottomPosition: 13
    };
  };
  
  const [srtSettings, setSrtSettings] = useState(getInitialSrtSettings);
  
  // 💾 Save subtitle settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('zenshin_subtitle_settings', JSON.stringify(srtSettings));
      console.log('💾 Saved subtitle settings to storage');
    } catch (err) {
      console.warn('⚠️ Failed to save subtitle settings:', err);
    }
  }, [srtSettings]);
  
  // 🔥 When subtitle settings change, re-apply subtitle mode (ONLY if video active)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitlesEnabled || !videoSrc) return;
    
    // Wait for tracks to be available
    const checkAndApply = () => {
      const tracks = video.textTracks;
      if (tracks.length > 0) {
        if (tracks[0].mode !== 'showing') {
          console.log('🔧 Settings changed - restoring subtitle mode');
          tracks[0].mode = 'showing';
        }
      }
    };
    
    // Try immediately
    setTimeout(checkAndApply, 50);
    // Try again after delay (in case tracks load later)
    setTimeout(checkAndApply, 500);
  }, [srtSettings, subtitlesEnabled, videoSrc]);
  
  // Refs for magnet/filename (needed for dynamic track injection)
  const [magnetEncoded, setMagnetEncoded] = useState('');
  const [decodedFilename, setDecodedFilename] = useState('');
  const [hlsSupported, setHlsSupported] = useState(false);
  const [useHls, setUseHls] = useState(false);
  
  let controlsTimeout;
  
  // 🔥 Helper: Force subtitle mode after settings change (only if video active)
  const forceSubtitleMode = () => {
    setTimeout(() => {
      const video = videoRef.current;
      // Only force if video is active and has tracks
      if (video && video.src && videoSrc && video.textTracks.length > 0 && subtitlesEnabledRef.current) {
        video.textTracks[0].mode = 'showing';
        console.log('🔧 Forced subtitle mode from settings');
      }
    }, 10);
  };
  
  // 💾 Track if settings were loaded from storage (show once)
  const [settingsLoadedFromStorage, setSettingsLoadedFromStorage] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('zenshin_subtitle_settings');
    if (saved && !settingsLoadedFromStorage) {
      setSettingsLoadedFromStorage(true);
      setTimeout(() => {
        toast.info('💾 ' + (t('player.settingsRestored') || 'Altyazı ayarlarınız yüklendi'), {
          description: t('player.settingsAutoSaved') || 'Ayarlar otomatik kaydediliyor',
          duration: 2000
        });
      }, 1000);
    }
  }, [settingsLoadedFromStorage, t]);
  
  // Check HLS.js support on mount
  useEffect(() => {
    const supported = Hls.isSupported();
    setHlsSupported(supported);
    console.log('🎬 HLS.js support:', supported ? '✅ YES' : '❌ NO (using native)');
  }, []);
  
  // Helper function: Inject MKV subtitle tracks dynamically
  const injectSubtitleTracks = (subTracks, magnet, filename) => {
    const video = videoRef.current;
    if (!video || subTracks.length === 0) return;
    
    console.log('📥 Injecting', subTracks.length, 'MKV subtitle track(s)...');
    
    if (!magnet || !filename) {
      console.error('❌ Cannot inject - magnet or filename is empty!');
      return;
    }
    
    // 🧹 ALWAYS remove old MKV tracks before injecting new ones
    const existingTracks = Array.from(video.querySelectorAll('track[data-mkv-track]'));
    if (existingTracks.length > 0) {
      console.log('🧹 Removing', existingTracks.length, 'old MKV track(s)');
      existingTracks.forEach(t => {
        // Cleanup lock if exists
        if (t._cleanupLock) {
          t._cleanupLock();
        }
        t.remove();
      });
    }
    
    // Cleanup global protection if exists
    if (video._subtitleProtectionCleanup) {
      console.log('🧹 Cleaning up global subtitle protection');
      video._subtitleProtectionCleanup();
      delete video._subtitleProtectionCleanup;
    }
    
    // Update availableSubtitles with proper IDs
    const injectedTracks = [];
    
    // Add each MKV subtitle as a <track> element
    subTracks.forEach((sub, index) => {
      const trackUrl = `${BACKEND_URL}/subtitle/${magnet}/${filename}/${sub.id}`;
      
      console.log(`  📝 Track ${index}: ${sub.label} (${sub.language})`);
      
      const trackElement = document.createElement('track');
      trackElement.kind = 'subtitles';
      trackElement.label = sub.label;
      trackElement.srclang = sub.language;
      trackElement.src = trackUrl;
      trackElement.default = false; // Don't auto-enable
      trackElement.setAttribute('data-mkv-track', 'true');
      trackElement.setAttribute('data-track-id', index.toString());
      
      video.appendChild(trackElement);
      
      // Add to injected tracks list with ACTUAL track index
      injectedTracks.push({
        id: index,
        label: sub.label,
        language: sub.language,
        codec: sub.codec
      });
      
                // 🔥 SIMPLE load handler
      trackElement.addEventListener('load', () => {
        console.log('✅ Track loaded:', sub.label);
        
        // 🔥 Track loaded successfully - ensure ready state
        if (!subtitlesReady) {
          console.log('💥 MKV subtitle track loaded! Setting subtitlesReady = true');
          setSubtitlesReady(true);
          setWaitingForSubtitle(false);
        }
        
        // Auto-enable if this is first track and subtitles enabled
        if (index === 0 && subtitlesEnabled) {
          // Wait for track to be fully loaded
          setTimeout(() => {
            // 🔥 FORCE multiple times to ensure it sticks
            trackElement.track.mode = 'showing';
            console.log('✅ Auto-enabled first MKV subtitle');
            
            // Force again after 100ms
            setTimeout(() => {
              trackElement.track.mode = 'showing';
              console.log('🔥 Re-forced subtitle mode (2nd time)');
            }, 100);
            
            // And again after 300ms
            setTimeout(() => {
              trackElement.track.mode = 'showing';
              console.log('🔥 Re-forced subtitle mode (3rd time)');
            }, 300);
            
            // 🔥 NOW start ULTIMATE protection - track is fully loaded
            setTimeout(() => {
              const video = videoRef.current;
              if (!video) return;
              
              // 🔥 ULTIMATE PROTECTION: MutationObserver + Interval + Event Listeners
              const protectSubtitles = () => {
                const tracks = video.textTracks;
                if (tracks.length > 0 && subtitlesEnabledRef.current) {
                  // Force showing if not already
                  if (tracks[0].mode !== 'showing') {
                    console.warn('⚠️ Track 0 mode changed to:', tracks[0].mode, '- Forcing back to showing!');
                    tracks[0].mode = 'showing';
                  }
                  
                  // Disable others
                  for (let i = 1; i < tracks.length; i++) {
                    if (tracks[i].mode !== 'disabled') {
                      tracks[i].mode = 'disabled';
                    }
                  }
                }
              };
              
              // Method 1: Interval (every 200ms for aggressive protection)
              const protectionInterval = setInterval(protectSubtitles, 200);
              
              // Method 2: MutationObserver (watch for DOM/attribute changes)
              const observer = new MutationObserver(() => {
                protectSubtitles();
              });
              
              // Observe the video element and its text tracks
              observer.observe(video, {
                attributes: true,
                childList: true,
                subtree: true,
                attributeFilter: ['kind', 'label', 'srclang', 'default']
              });
              
              // Method 3: Track mode change listeners
              const addTrackListeners = () => {
                const tracks = video.textTracks;
                for (let i = 0; i < tracks.length; i++) {
                  tracks[i].addEventListener('change', protectSubtitles);
                }
              };
              addTrackListeners();
              
              // Store cleanup
              if (!video._subtitleProtectionCleanup) {
                video._subtitleProtectionCleanup = () => {
                  clearInterval(protectionInterval);
                  observer.disconnect();
                  console.log('🧹 Protection cleaned up');
                };
              }
              
              console.log('🔥 ULTIMATE subtitle protection activated (Interval + Observer + Listeners)');
            }, 300); // Wait 300ms after enabling
          }, 100);
        }
      });
      
      trackElement.addEventListener('error', (e) => {
        // 🔥 Check if video is still active (not removed)
        const video = videoRef.current;
        if (!video || !video.src || video.src === '') {
          console.log('ℹ️ Track error ignored - video was removed');
          return;
        }
        
        console.error('❌ Failed to load:', sub.label);
        // Continue anyway - don't block video
        if (index === 0 && !subtitlesReady) {
          console.log('💥 First subtitle failed, but continuing...');
          setSubtitlesReady(true);
          setWaitingForSubtitle(false);
        }
      }, { once: true });
    });
    
    // Update available subtitles list
    setAvailableSubtitles(injectedTracks);
    console.log('✅ Injected tracks updated in state:', injectedTracks.length);
    
    // 🔥 GLOBAL PROTECTION: Will start AFTER tracks are loaded
    // Don't start protection immediately - wait for track load event
  };

  // Check if we need external audio (4K mode)
  useEffect(() => {
    const is4K = quality === '4K' && originalVideoSrc && videoSrc !== originalVideoSrc;
    setUseExternalAudio(is4K);
    console.log(is4K ? '🌟 4K mode: Using original audio' : '📺 Standard mode: Using internal audio');
  }, [quality, originalVideoSrc, videoSrc]);

  // 🔄 FULL RESET when video source changes
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // 🔥 If videoSrc is empty, clean everything and return
    if (!video) return;
    
    if (!videoSrc || videoSrc === '') {
      console.log('🧹 === VIDEO SOURCE CLEARED - FULL CLEANUP ===');
      
      // 1. Reset all subtitle states
      setSubtitlesReady(false);
      setWaitingForSubtitle(false);
      setAvailableSubtitles([]);
      setIsVideoReady(false);
      console.log('  ✅ States reset');
      
      // 2. Remove all track elements
      const allTracks = video.querySelectorAll('track');
      if (allTracks.length > 0) {
        console.log(`  🧹 Removing ${allTracks.length} track(s)`);
        allTracks.forEach(t => {
          if (t._cleanupLock) {
            t._cleanupLock();
            console.log('    🧹 Cleaned track lock');
          }
          t.remove();
        });
      }
      
      // 3. Cleanup global protection interval
      if (video._subtitleProtectionCleanup) {
        console.log('  🧹 Stopping global protection interval');
        video._subtitleProtectionCleanup();
        delete video._subtitleProtectionCleanup;
      }
      
      // 4. Disable all textTracks
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
      
      console.log('✅ Full subtitle cleanup complete');
      return;
    }
    
    // 🧹 RESET ALL STATE on new video
    console.log('🧹 Resetting player state for new video...');
    setAvailableSubtitles([]);
    setAvailableAudioTracks([]);
    setCurrentSubtitleId(0);
    setCurrentAudioTrack(0);
    setIsVideoReady(false);
    setSubtitlesReady(false);
    setWaitingForSubtitle(false);
    setMagnetEncoded('');
    setDecodedFilename('');
    
    console.log('🔄 Video source changed to:', videoSrc.includes('4K') ? '4K' : '1080p');
    
    // KAYDET: Mevcut zaman ve oynatma durumu - GÜÇLÜ KORUMA
    const actualVideoTime = video.currentTime;
    const savedTime = actualVideoTime > 3 ? actualVideoTime : (currentVideoTime > 3 ? currentVideoTime : initialTime);
    const wasPlaying = !video.paused;
    
    console.log('💾 Saving state - Actual:', actualVideoTime.toFixed(2), '| Saved:', savedTime.toFixed(2), 's | Playing:', wasPlaying);
    
    // Mute video if using external audio
    video.muted = useExternalAudio;
    
    // 🧹 Cleanup previous HLS instance
    if (hlsRef.current) {
      console.log('🧹 Cleaning up previous HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // 🧹 Remove ALL old tracks (both external and MKV) with cleanup
    const allOldTracks = video.querySelectorAll('track');
    if (allOldTracks.length > 0) {
      console.log('🧹 Removing', allOldTracks.length, 'old track(s)');
      allOldTracks.forEach(track => {
        if (track._cleanupLock) track._cleanupLock();
        track.remove();
      });
    }
    
    // Cleanup global protection if exists
    if (video._subtitleProtectionCleanup) {
      video._subtitleProtectionCleanup();
      delete video._subtitleProtectionCleanup;
    }
    
    // 🧹 Clear text tracks array
    while (video.textTracks.length > 0) {
      try {
        const track = video.textTracks[0];
        track.mode = 'disabled';
      } catch (e) {
        break;
      }
    }
    
    // SMOOTH RELOAD - preload before switching
    const handleCanPlay = () => {
      console.log('✅ Video ready (duration:', video.duration.toFixed(2), 's)');
      setIsVideoReady(true);
      
      // Check subtitle source
      if (!subtitleSrc) {
        console.log('ℹ️ No subtitle source - marking as ready');
        setSubtitlesReady(true);
        setWaitingForSubtitle(false);
      } else {
        console.log('⏳ Subtitle source exists, waiting for track load...');
        setWaitingForSubtitle(true);
        // Will be set to true by track load handler
      }
      
      // RESTORE: Zamanı geri yükle - MUTLAK KORUMA
      const timeToRestore = savedTime > 0 ? savedTime : (currentVideoTime > 0 ? currentVideoTime : initialTime);
      
      console.log('🔍 Restore candidates - savedTime:', savedTime.toFixed(2), '| currentVideoTime:', currentVideoTime.toFixed(2), '| initialTime:', initialTime.toFixed(2));
      console.log('✅ Will restore to:', timeToRestore.toFixed(2), 's');
      
      if (timeToRestore > 0 && timeToRestore < video.duration) {
        // FORCE restore multiple times
        video.currentTime = timeToRestore;
        setCurrentTime(timeToRestore);
        setCurrentVideoTime(timeToRestore);
        
        setTimeout(() => {
          if (video.currentTime < timeToRestore - 5) {
            console.log('🔄 Forcing time restore again:', timeToRestore.toFixed(2), 's');
            video.currentTime = timeToRestore;
          }
        }, 100);
        
        console.log('⏩ Time restored to:', timeToRestore.toFixed(2), 's');
      }
      
      // NOT auto-playing here - will wait for subtitlesReady trigger
      console.log('🕒 Video ready, waiting for subtitles...');
      
      // Sync audio
      if (useExternalAudio && audio) {
        audio.currentTime = savedTime;
        if (wasPlaying) {
          audio.play().catch(err => console.log('Audio autoplay prevented:', err));
        }
      }
      

    };
    
    // Check if source is HLS (m3u8) or regular video
    const isHlsSource = videoSrc.includes('.m3u8');
    
    if (isHlsSource && hlsSupported) {
      // Use HLS.js for .m3u8 sources
      console.log('🎬 Loading with HLS.js:', videoSrc);
      
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        // 🚀 ANTI-STUTTER OPTIMIZATIONS
        maxBufferLength: 60,        // 60 seconds of buffer (smooth playback)
        maxMaxBufferLength: 120,    // Max 2 minutes buffer
        maxBufferSize: 60 * 1000 * 1000, // 60 MB max buffer
        maxBufferHole: 0.5,         // Fill gaps > 0.5s
        highBufferWatchdogPeriod: 2, // Check buffer health every 2s
        nudgeMaxRetry: 10,          // Retry on stalls
        backBufferLength: 30        // Keep 30s back buffer for seeking
      });
      
      hlsRef.current = hls;
      setUseHls(true);
      
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('✅ HLS manifest parsed');
        console.log('  Levels:', data.levels.length);
        console.log('  Audio tracks:', hls.audioTracks?.length || 0);
        console.log('  Subtitle tracks:', hls.subtitleTracks?.length || 0);
        
        // Get audio tracks from HLS instance
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const audioTracks = hls.audioTracks.map((track, idx) => ({
            id: idx,
            title: track.name || `Audio ${idx + 1}`,
            language: track.lang || 'unknown',
            codec: 'aac',
            channels: '2ch'
          }));
          setAvailableAudioTracks(audioTracks);
          console.log('🎵 HLS Audio tracks loaded:', audioTracks.length);
          audioTracks.forEach((t, i) => {
            console.log(`    ${i + 1}. ${t.title} (${t.language})`);
          });
        }
        
        // Get subtitle tracks from HLS instance
        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          const subTracks = hls.subtitleTracks.map((track, idx) => ({
            id: idx,
            label: track.name || `Subtitle ${idx + 1}`,
            language: track.lang || 'unknown',
            codec: 'vtt'
          }));
          setAvailableSubtitles(subTracks);
          console.log('📝 HLS Subtitle tracks loaded:', subTracks.length);
          subTracks.forEach((t, i) => {
            console.log(`    ${i + 1}. ${t.label} (${t.language})`);
          });
        }
        
        handleCanPlay();
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS error:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('🔄 Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🔄 Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.log('❌ Fatal error, destroying HLS');
              hls.destroy();
              break;
          }
        }
      });
      
    } else if (isHlsSource && !hlsSupported && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      console.log('🍎 Using native HLS (Safari)');
      setUseHls(false);
      video.src = videoSrc;
      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.load();
      
    } else {
      // Regular video file (MKV, MP4, etc.)
      console.log('📼 Loading regular video:', videoSrc);
      setUseHls(false);
      video.src = videoSrc;
      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.load();
    }
    
    // Load external audio if needed
    if (useExternalAudio && audio && originalVideoSrc) {
      audio.load();
    }
    

    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoSrc, originalVideoSrc, useExternalAudio, hlsSupported, subtitlesEnabled]);

  // Load stream info from backend (audio + subtitle tracks)
  useEffect(() => {
    if (!videoSrc || !isVideoReady) {
      console.log('⏸️ Waiting for video to be ready...');
      return;
    }
    
    console.log('🚀 Video ready, fetching stream info...');
    
    // Extract magnet and filename from videoSrc
    const urlMatch = videoSrc.match(/\/streamfile\/([^/]+)\/(.+?)(?:\?|$)/);
    if (!urlMatch) {
      console.log('⚠️ Could not parse video URL for stream info');
      console.log('  Video URL:', videoSrc);
      console.log('  ⚠️ magnetEncoded/decodedFilename will be EMPTY!');
      return;
    }
    
    const [, magnet, filename] = urlMatch;
    // Filename is already URL-encoded, use it as-is
    const streamInfoUrl = `${BACKEND_URL}/stream-info/${magnet}/${filename}`;
    
    console.log('🔍 === FETCHING STREAM INFO ===');
    console.log('  Magnet:', magnet.substring(0, 40) + '...');
    console.log('  Filename (encoded):', filename);
    console.log('  Filename (decoded):', decodeURIComponent(filename));
    console.log('  Request URL:', streamInfoUrl);
    
    // Store for subtitle track injection
    setMagnetEncoded(magnet);
    setDecodedFilename(filename); // Store ENCODED filename
    console.log('💾 Stored for injection - Magnet:', magnet.substring(0, 20) + '...', '| Filename:', filename.substring(0, 30) + '...');
    
    fetch(streamInfoUrl)
      .then(res => {
        console.log('🎬 Stream info response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('🎬 === STREAM INFO RECEIVED ===');
        console.log('  Raw data:', data);
        
        // Audio tracks
        if (data.audioStreams && data.audioStreams.length > 0) {
          setAvailableAudioTracks(data.audioStreams);
          console.log('🎵 Audio tracks:', data.audioStreams.length);
          data.audioStreams.forEach((a, i) => {
            console.log(`  ${i + 1}. ${a.title} (${a.language}) - ${a.codec} ${a.channels}ch`);
          });
          setCurrentAudioTrack(0);
        } else {
          setAvailableAudioTracks([]);
          console.log('⚠️ No audio tracks in response');
        }
        
        // Subtitle tracks from MKV
        if (data.subtitleStreams && data.subtitleStreams.length > 0) {
          const subTracks = data.subtitleStreams.map(s => ({
            id: s.id,
            label: s.title,
            language: s.language,
            codec: s.codec
          }));
          console.log('📝 Subtitle tracks from MKV:', data.subtitleStreams.length);
          data.subtitleStreams.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.title} (${s.language}) - ${s.codec}`);
          });
          
          // Store for subtitle dropdown
          setAvailableSubtitles(subTracks);
          
          // INJECT subtitle tracks to DOM
          console.log('🚀 Injecting subtitle tracks...');
          
          // Inject immediately after video is ready
          setTimeout(() => {
            injectSubtitleTracks(subTracks, magnet, filename);
            
            // 🔥 QUICK START: Mark as ready after 800ms (don't wait for slow load event)
            setTimeout(() => {
              if (!subtitlesReady) {
                console.log('💥 Quick start - marking as READY (800ms timeout)');
                setSubtitlesReady(true);
                setWaitingForSubtitle(false);
                
                // Ensure subtitle mode is set
                const video = videoRef.current;
                if (video && video.textTracks.length > 0 && subtitlesEnabledRef.current) {
                  video.textTracks[0].mode = 'showing';
                  console.log('🔥 Forced subtitle mode during quick start');
                }
              }
            }, 800); // 800ms quick start
          }, 300);
        } else {
          console.log('⚠️ No subtitle tracks in MKV - marking as ready');
          setSubtitlesReady(true);
          setWaitingForSubtitle(false);
        }
      })
      .catch(err => {
        console.error('❌ Failed to fetch stream info:', err.message);
        setAvailableAudioTracks([]);
        setAvailableSubtitles([]);
      });
  }, [videoSrc, isVideoReady, subtitleSrc]); // Re-fetch when subtitle changes too
  
  // 🔥 Auto-ready if no subtitle source
  useEffect(() => {
    if (!subtitleSrc) {
      console.log('ℹ️ No subtitle source - ready immediately');
      setSubtitlesReady(true);
      setWaitingForSubtitle(false);
    } else {
      setSubtitlesReady(false); // Reset when subtitle source exists
      // Will be set to ready by injection timeout (800ms)
    }
  }, [subtitleSrc]);

  // 🔥 AUTO-PLAY when subtitles are ready (ONCE per video load)
  const autoPlayTriggeredRef = useRef(false);
  
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Reset auto-play flag when video source changes
    if (videoSrc) {
      autoPlayTriggeredRef.current = false;
    }
  }, [videoSrc]);
  
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Only auto-play ONCE per video load
    if (subtitlesReady && video && isVideoReady && !autoPlayTriggeredRef.current) {
      autoPlayTriggeredRef.current = true; // Mark as triggered
      console.log('💥 Subtitles ready! Auto-playing video...');
      
      // Auto-play immediately with AGGRESSIVE subtitle force
      setTimeout(() => {
        if (video.paused) {
          // 🔥 MULTI-FORCE subtitle mode (5 times)
          const forceSubtitleMultipleTimes = () => {
            const tracks = video.textTracks;
            if (tracks.length > 0) {
              tracks[0].mode = 'showing';
              console.log('🔥 Force 1:', tracks[0].label);
              
              setTimeout(() => { tracks[0].mode = 'showing'; console.log('🔥 Force 2'); }, 50);
              setTimeout(() => { tracks[0].mode = 'showing'; console.log('🔥 Force 3'); }, 150);
              setTimeout(() => { tracks[0].mode = 'showing'; console.log('🔥 Force 4'); }, 300);
              setTimeout(() => { tracks[0].mode = 'showing'; console.log('🔥 Force 5'); }, 600);
            }
          };
          
          // Force BEFORE play
          forceSubtitleMultipleTimes();
          
          video.play().then(() => {
            console.log('▶️ Video auto-play started');
            
            // Force AFTER play (again)
            forceSubtitleMultipleTimes();
            
            if (useExternalAudio && audio) {
              audio.play().catch(err => console.log('Audio autoplay prevented:', err));
            }
            
            toast.success('▶️ ' + (t('player.playing') || 'Playing'), {
              description: t('player.subtitlesLoaded') || 'Subtitles loaded successfully',
              duration: 2000
            });
          }).catch(err => {
            console.log('⚠️ Autoplay prevented by browser:', err);
            toast.info('🎬 ' + (t('player.readyToPlay') || 'Ready to play'), {
              description: t('player.clickToPlay') || 'Click play button to start',
              duration: 3000
            });
          });
        }
      }, 200);
    }
  }, [subtitlesReady, isVideoReady, useExternalAudio, t]);
  


  // 🎯 Subtitle Control - AGGRESSIVE & PERSISTENT
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // 🔥 If no video source, don't start protection
    if (!videoSrc || videoSrc === '') {
      console.log('ℹ️ No video source - skipping subtitle protection');
      return;
    }

    const syncSubtitleState = () => {
      const tracks = video.textTracks;
      if (tracks.length === 0) return;
      
      if (subtitlesEnabled) {
        // Enable first track ONLY
        tracks[0].mode = 'showing';
        
        // Disable others
        for (let i = 1; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
        
        console.log('✅ Subtitle ON:', tracks[0].label);
      } else {
        // Disable ALL
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
        console.log('❌ Subtitles OFF');
      }
    };

    // Sync on metadata load and can play
    video.addEventListener('loadedmetadata', syncSubtitleState);
    video.addEventListener('canplay', syncSubtitleState);
    
    // Initial sync + delayed sync
    syncSubtitleState();
    const timeout1 = setTimeout(syncSubtitleState, 500);
    const timeout2 = setTimeout(syncSubtitleState, 1500);
    
    // 🔥 AGGRESSIVE: Keep checking subtitle state frequently
    // Check more often if settings menu is open (500ms), otherwise every 2 seconds
    const checkInterval = showSettingsMenu ? 500 : 2000;
    const keepAliveInterval = setInterval(() => {
      const tracks = video.textTracks;
      if (tracks.length > 0 && subtitlesEnabledRef.current) { // 🔥 Use ref!
        // If subtitle disappeared, force it back
        if (tracks[0].mode !== 'showing') {
          console.warn('⚠️ Subtitle disappeared! Restoring...');
          tracks[0].mode = 'showing';
        }
      }
    }, checkInterval);

    return () => {
      video.removeEventListener('loadedmetadata', syncSubtitleState);
      video.removeEventListener('canplay', syncSubtitleState);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearInterval(keepAliveInterval);
    };
  }, [subtitlesEnabled, showSettingsMenu, videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialTime > 0) {
        video.currentTime = initialTime;
        console.log('⏩ Jumped to:', initialTime);
      }
      
      // Respect user's subtitle choice
      console.log('📺 Metadata loaded, subtitle state:', subtitlesEnabled);
    };

    const handleTimeUpdate = () => {
      const currentVideoTime = video.currentTime;
      const videoDuration = video.duration;
      
      // TIMEUPDATE PROTECTION: Only block if jumping from FAR position
      if (currentVideoTime < 3 && currentTime > 120 && videoDuration > 0) {
        console.warn('🚫 BLOCKED: Suspicious jump from', currentTime.toFixed(2), 's to', currentVideoTime.toFixed(2), 's');
        video.currentTime = currentTime; // Restore position
        return;
      }
      
      // Video sonuna gelince loop yapmasını engelle
      if (videoDuration && currentVideoTime >= videoDuration - 1) {
        console.log('🏁 Video ending at:', currentVideoTime.toFixed(2), 's');
        video.pause();
        setIsPlaying(false);
        return;
      }
      
      setCurrentTime(currentVideoTime);
      setCurrentVideoTime(currentVideoTime);
      
      // Sync audio with video (4K mode)
      if (useExternalAudio && audio && !audio.paused) {
        const timeDiff = Math.abs(currentVideoTime - audio.currentTime);
        if (timeDiff > 0.1) {
          audio.currentTime = currentVideoTime;
        }
      }
      
      if (onTimeUpdate) {
        onTimeUpdate(currentVideoTime, videoDuration);
      }
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const percentBuffered = (bufferedEnd / video.duration) * 100;
        setBuffered(percentBuffered);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // Sync audio play
      if (useExternalAudio && audio && audio.paused) {
        audio.play().catch(err => console.log('Audio sync play failed:', err));
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      // Sync audio pause
      if (useExternalAudio && audio && !audio.paused) {
        audio.pause();
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [initialTime, onTimeUpdate, useExternalAudio]);

  // Auto-hide controls - GEÇ KAYBOL
  const handleMouseMove = (e) => {
    setShowControls(true);
    clearTimeout(controlsTimeout);
    
    // Menü açıksa kontrolleri gizleme
    if (showSettingsMenu || showSubtitleLanguageMenu || showAudioTrackMenu) {
      return;
    }
    
    // Sadece oynatılıyorsa ve mouse hareket etmiyorsa gizle
    if (isPlaying) {
      // 5 saniye sonra gizle (daha uzun süre)
      controlsTimeout = setTimeout(() => {
        if (!showSettingsMenu && !showSubtitleLanguageMenu && !showAudioTrackMenu) {
          setShowControls(false);
        }
      }, 5000);
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    
    // 🔥 SADECE ilk yükleme sırasında bekle - video başladıktan sonra her zaman pause/play yap
    if (!subtitlesReady && subtitleSrc && !autoPlayTriggeredRef.current) {
      toast.info('⏸️ ' + (t('player.waitingSubtitle') || 'Waiting for subtitles...'), {
        description: t('player.willAutoPlay') || 'Will auto-play when ready',
        duration: 2000
      });
      return;
    }
    
    if (video.paused) {
      video.play();
      if (useExternalAudio && audio) {
        audio.play();
      }
    } else {
      video.pause();
      if (useExternalAudio && audio) {
        audio.pause();
      }
    }
  };

  const handleProgressClick = (e) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * video.duration;
    
    video.currentTime = newTime;
    if (useExternalAudio && audio) {
      audio.currentTime = newTime;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (useExternalAudio && audio) {
      audio.muted = newMuted;
    } else {
      video.muted = newMuted;
    }
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    if (useExternalAudio && audio) {
      audio.volume = newVolume;
      audio.muted = newVolume === 0;
    } else {
      video.volume = newVolume;
      video.muted = newVolume === 0;
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      console.log('📺 Fullscreen:', isNowFullscreen ? 'ON' : 'OFF');
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const newState = !subtitlesEnabled;
    const tracks = video.textTracks;
    
    console.log('🔄 Toggling subtitles:', newState ? 'ON' : 'OFF');
    
    // Update state FIRST
    setSubtitlesEnabled(newState);
    
    // Then apply to tracks
    if (newState) {
      // Enable ONLY first track
      if (tracks.length > 0) {
        tracks[0].mode = 'showing';
        console.log('✅ Enabled:', tracks[0].label);
        
        // Disable others
        for (let i = 1; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
      }
    } else {
      // Disable ALL tracks
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled';
        console.log('❌ Disabled:', tracks[i].label);
      }
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleQualitySelect = (newQuality) => {
    setSelectedQuality(newQuality);
    if (onQualityChange) {
      onQualityChange(newQuality);
    }
    toast.success(`✨ ${newQuality} seçildi`, {
      description: 'Video yeniden yükleniyor...',
      duration: 2000
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      const video = videoRef.current;
      if (!video) return;

      switch(e.key) {
        case 'Escape':
          // Menüyü kapat
          if (showSettingsMenu) {
            e.preventDefault();
            setShowSettingsMenu(false);
          }
          break;
        case ' ':
          // Menü açıksa space ile kapan
          if (showSettingsMenu) {
            e.preventDefault();
            setShowSettingsMenu(false);
          } else {
            e.preventDefault();
            togglePlayPause();
          }
          break;
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          if (availableSubtitles.length > 0) {
            setShowSubtitleLanguageMenu(!showSubtitleLanguageMenu);
          } else {
            toggleSubtitles();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime -= 5;
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime += 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showSettingsMenu, availableSubtitles, showSubtitleLanguageMenu, toggleSubtitles, togglePlayPause, toggleMute, toggleFullscreen]);
  
  // Video ended & seeking listeners - ABSOLUTE PROTECTION!
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let isEndingHandled = false;
    
    const handleEnded = () => {
      if (isEndingHandled) return;
      isEndingHandled = true;
      
      console.log('🏁 Video ended - LOCKING at end position');
      setIsPlaying(false);
      
      // Video'yu sonunda sabitle
      setTimeout(() => {
        video.pause();
        if (video.duration) {
          video.currentTime = video.duration - 0.1;
        }
      }, 10);
    };
    
    const handleSeeking = () => {
      const seekTime = video.currentTime;
      
      // BAŞA DÖNME ENGELİ - GÜÇLÜ!
      if (seekTime < 3 && currentTime > 60 && !isEndingHandled) {
        console.error('🚫 BLOCKED: Seek to', seekTime.toFixed(2), 's from', currentTime.toFixed(2), 's');
        
        // Bloke et ve geri döndür
        setTimeout(() => {
          video.currentTime = currentTime;
        }, 0);
      }
    };
    
    video.addEventListener('ended', handleEnded);
    video.addEventListener('seeking', handleSeeking);
    
    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('seeking', handleSeeking);
      isEndingHandled = false;
    };
  }, [currentTime]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full bg-black rounded-lg group"
      style={{ overflow: isFullscreen ? 'visible' : 'hidden' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        // Fare player dışına çıkınca GEÇ gizle
        clearTimeout(controlsTimeout);
        if (isPlaying && !showSettingsMenu && !showSubtitleLanguageMenu && !showAudioTrackMenu) {
          controlsTimeout = setTimeout(() => {
            setShowControls(false);
          }, 8000); // 8 saniye - çok geç
        }
      }}
      onClick={(e) => {
        // Menüleri kapat - HER TİKLAMA
        const target = e.target;
        
        // Menü içeriğini kontrol et
        const clickedInsideSettings = target.closest('.settings-menu');
        const clickedInsideSubMenu = target.closest('.subtitle-lang-menu');
        const clickedButton = target.closest('.subtitle-menu-btn') || 
                             target.closest('button[title="Settings"]');
        
        // Menü/buton dışında herhangi bir yere tıklandıysa kapat
        if (!clickedInsideSettings && !clickedInsideSubMenu && !clickedButton) {
          if (showSettingsMenu || showSubtitleLanguageMenu) {
            setShowSettingsMenu(false);
            setShowSubtitleLanguageMenu(false);
            console.log('🚫 Menüler kapatıldı (player tıklama)');
            e.stopPropagation(); // Video pause olmasın
          }
        }
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full aspect-video"
        style={{
          filter: 'saturate(1.15) contrast(1.05) brightness(1.02)'
        }}
        src={videoSrc}
        onClick={togglePlayPause}
        onContextMenu={(e) => {
          // 🔥 Allow browser's native context menu for track selection
          // Users can right-click → Audio/Subtitles
          console.log('🖱️ Browser context menu opened');
        }}
        crossOrigin="anonymous"
        muted={useExternalAudio}
        preload="auto"
        playsInline
        controlsList="nodownload" // 🔥 Prevent download button in native controls
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!video) return;
          console.log('📺 === VIDEO METADATA LOADED ===');
          console.log('  TextTracks:', video.textTracks.length);
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            console.log(`    ${i + 1}. ${track.kind} - ${track.label} (${track.language})`);
          }
          
          // Check AudioTracks API
          if (video.audioTracks && video.audioTracks.length > 0) {
            console.log('  🎵 AudioTracks (HTML5 API):', video.audioTracks.length);
            for (let i = 0; i < video.audioTracks.length; i++) {
              const track = video.audioTracks[i];
              console.log(`    ${i + 1}. ${track.label} (${track.language}) - enabled:`, track.enabled);
            }
          } else {
            console.log('  ⚠️ AudioTracks: NOT SUPPORTED');
            console.log('    Browser does not support HTML5 AudioTracks API');
          }
          
          // 🔄 Check subtitle status
          setTimeout(() => {
            const tracks = video.textTracks;
            
            // Check if tracks are ready (have cues loaded)
            if (tracks.length > 0) {
              let readyCount = 0;
              for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].cues && tracks[i].cues.length > 0) {
                  readyCount++;
                }
              }
              
              if (readyCount > 0) {
                console.log('💥 TextTracks ready (', readyCount, '/', tracks.length, ') - marking subtitles as READY!');
                setSubtitlesReady(true);
                setWaitingForSubtitle(false);
                
                // Enable if user wants
                if (subtitlesEnabled) {
                  tracks[0].mode = 'showing';
                  console.log('✅ Auto-enabled subtitle');
                }
              }
            }
            
            // TRIGGER subtitle injection if tracks exist but not yet injected
            if (availableSubtitles.length > 0 && magnetEncoded && decodedFilename) {
              const injectedCount = video.querySelectorAll('track[data-mkv-track]').length;
              if (injectedCount === 0) {
                console.log('🔄 Metadata loaded - triggering subtitle injection');
                injectSubtitleTracks(availableSubtitles, magnetEncoded, decodedFilename);
              }
            }
          }, 100);
        }}
      >
        {/* NOT USED - MKV tracks injected dynamically */}
        Your browser does not support the video tag.
      </video>

      {/* Custom Subtitle Styling - SRT ONLY */}
      <style>{`
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 197, 94, 0.6);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 197, 94, 0.8);
        }
        
        /* === SRT ALTYAZILARI - İLERLEME ÇUBUĞU ÜSTÜNDE === */
        video::cue {
          font-family: '${srtSettings.fontFamily}', 'Arial', sans-serif !important;
          font-size: ${srtSettings.fontSize}px !important;
          font-weight: ${srtSettings.fontWeight} !important;
          color: ${srtSettings.color} !important;
          background-color: ${srtSettings.backgroundColor} !important;
          text-shadow: 
            -${srtSettings.strokeWidth}px -${srtSettings.strokeWidth}px 0 #000,
            ${srtSettings.strokeWidth}px -${srtSettings.strokeWidth}px 0 #000,
            -${srtSettings.strokeWidth}px ${srtSettings.strokeWidth}px 0 #000,
            ${srtSettings.strokeWidth}px ${srtSettings.strokeWidth}px 0 #000,
            0px 0px ${srtSettings.shadowBlur}px rgba(0,0,0,0.95) !important;
          line-height: 1.4 !important;
          padding: 0.25em 0.5em !important;
          border-radius: 2px !important;
          white-space: pre-line !important;
          text-align: center !important;
          display: block !important;
          margin: 0.2em auto !important;
          max-width: 85% !important;
        }
        
        /* === KONTEYNER - SABİT POZİSYON === */
        video::-webkit-media-text-track-container {
          position: absolute !important;
          bottom: ${srtSettings.bottomPosition}% !important;
          top: auto !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          max-height: 18% !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-end !important;
          align-items: center !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
          overflow: visible !important;
          padding: 0 25px 18px 25px !important;
          gap: 0.15em !important;
        }
        
        video::-webkit-media-text-track-display {
          position: relative !important;
          width: 100% !important;
          overflow: visible !important;
        }
      `}</style>

      {/* 🔥 SUBTITLE WAITING OVERLAY - Blocks playback */}
      {!subtitlesReady && subtitleSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-base font-semibold mb-2">📝 {t('player.loadingSubtitle') || 'Altyazı yükleniyır...'}</p>
            <p className="text-sm text-gray-400">{t('player.willAutoPlay') || 'Video hazır olduğunda otomatik başlayacak'}</p>
            <div className="mt-4 px-4 py-2 bg-violet-600/30 rounded-lg border border-violet-500/50">
              <p className="text-xs text-violet-300">ℹ️ {t('player.pleaseWait') || 'Lütfen bekleyin...'}</p>
            </div>
            <div className="mt-3 px-4 py-2 bg-yellow-600/20 rounded-lg border border-yellow-500/40">
              <p className="text-xs text-yellow-300">⚠️ {t('player.ifNotAutoStart') || 'Eğer video otomatik başlamazsa F5 atın'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Element (for 4K mode) */}
      {useExternalAudio && originalVideoSrc && (
        <audio
          ref={audioRef}
          src={originalVideoSrc}
          className="hidden"
          crossOrigin="anonymous"
        />
      )}

      {/* Top Bar - Quality & Subtitle Info */}
      <div 
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent px-4 py-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        onMouseEnter={() => {
          setShowControls(true);
          clearTimeout(controlsTimeout);
        }}
        onMouseLeave={handleMouseMove}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          {/* Title/Info */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-violet-600/80 rounded-lg backdrop-blur-sm">
              <span className="text-white font-bold text-sm">ZENSHIN PLAYER</span>
            </div>
            {subtitleSrc && (
              <div className={`px-2 py-1 rounded text-xs font-semibold ${
                subtitlesEnabled 
                  ? 'bg-green-500/80 text-white' 
                  : 'bg-gray-600/80 text-gray-300'
              }`}>
                {subtitlesEnabled ? '✓ CC' : '✗ CC'}
              </div>
            )}
          </div>

          {/* REMOVED - Tek ayar butonu alt kısımda */}
          <div className="flex gap-2">
            {/* Boş - Sade tasarım */}
          </div>
        </div>

        {/* UNIFIED SETTINGS MENU - KALITE + ALTYAZI */}
        {showSettingsMenu && (
          <div 
            className={`settings-menu fixed bg-gray-900/98 backdrop-blur-md rounded-lg border-2 border-green-500/50 shadow-2xl p-4 min-w-[340px] max-h-[65vh] overflow-y-auto custom-scrollbar z-[9999] ${
              isFullscreen ? 'bottom-24 right-8' : 'absolute top-14 right-4'
            }`}
            onMouseEnter={() => clearTimeout(controlsTimeout)}
            onMouseLeave={handleMouseMove}
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-400 font-semibold mb-3 px-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>⚙️ {t('player.playerSettings').toUpperCase()}</span>
                {useHls && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-green-600/80 text-white font-bold">
                    HLS
                  </span>
                )}
              </div>
              <button onClick={() => setShowSettingsMenu(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            {/* QUALITY SELECTOR */}
            {upscaleAvailable && (
              <div className="mb-4 p-3 bg-violet-600/10 border-2 border-violet-600/40 rounded-lg">
                <div className="text-xs text-violet-400 font-bold mb-2">🎬 {t('player.quality').toUpperCase()}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQualitySelect('1080p')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedQuality === '1080p'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📺 {t('player.standard1080p')}
                  </button>
                  <button
                    onClick={() => handleQualitySelect('4K')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedQuality === '4K'
                        ? 'bg-violet-600 text-white shadow-lg animate-pulse'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    ⚡ {t('player.upscaleActive').replace('!', '')}
                  </button>
                </div>
              </div>
            )}

            {/* SUBTITLE SECTION */}
            {!subtitleSrc && (
              <div className="mb-4 p-3 bg-yellow-600/10 border-2 border-yellow-600/40 rounded-lg text-center">
                <div className="text-yellow-400 text-sm">⚠️ {t('player.subtitleNotFound')}</div>
                <div className="text-xs text-gray-400 mt-1">{t('player.noSubtitleInMkv')}</div>
              </div>
            )}

            {/* Subtitle Info - SADECE SRT */}
            {subtitleSrc && (
              <>
                <div className="mb-3 p-3 bg-blue-600/10 border-2 border-blue-600/40 rounded-lg">
                  <div className="text-xs text-blue-400 font-bold mb-2">🎬 {t('player.subtitle').toUpperCase()}</div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{t('player.format')}:</span>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-600/30 text-blue-300">
                      📝 SRT
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    ℹ️ {t('player.aboveProgressBar')}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 text-center mb-3">
                  {t('player.subtitleSettings')}
                </div>
              </>
            )}
            
            {/* Font Size */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.fontSize')}: {srtSettings.fontSize}px</label>
              <input
                type="range"
                min="16"
                max="56"
                value={srtSettings.fontSize}
                onChange={(e) => {
                  setSrtSettings({...srtSettings, fontSize: parseInt(e.target.value)});
                  forceSubtitleMode();
                }}
                className="w-full accent-green-500"
              />
              <div className="flex gap-1 mt-1">
                {[20, 24, 28, 32, 40].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSrtSettings({...srtSettings, fontSize: size});
                      forceSubtitleMode();
                    }}
                    className={`flex-1 px-2 py-1 rounded text-xs ${
                      srtSettings.fontSize === size 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.fontFamily')}</label>
              <select
                value={srtSettings.fontFamily}
                onChange={(e) => {
                  setSrtSettings({...srtSettings, fontFamily: e.target.value});
                  forceSubtitleMode();
                }}
                className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
                <option value="Georgia">Georgia</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Impact">Impact</option>
              </select>
            </div>

            {/* Font Weight */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.fontWeight')}</label>
              <div className="grid grid-cols-3 gap-2">
                {['normal', 'bold', '900'].map((weight, idx) => (
                  <button
                    key={weight}
                    onClick={() => {
                      setSrtSettings({...srtSettings, fontWeight: weight});
                      forceSubtitleMode();
                    }}
                    className={`px-2 py-1 rounded text-xs ${
                      weight === 'normal' ? '' : weight === 'bold' ? 'font-bold' : 'font-black'
                    } ${
                      srtSettings.fontWeight === weight
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {weight === 'normal' ? t('player.normal') : weight === 'bold' ? t('player.bold') : t('player.veryBold')}
                  </button>
                ))}
              </div>
            </div>

            {/* Stroke Width */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.strokeWidth')}: {srtSettings.strokeWidth}px</label>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={srtSettings.strokeWidth}
                onChange={(e) => {
                  setSrtSettings({...srtSettings, strokeWidth: parseFloat(e.target.value)});
                  forceSubtitleMode();
                }}
                className="w-full accent-green-500"
              />
            </div>

            {/* Shadow Blur */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.shadowIntensity')}: {srtSettings.shadowBlur}px</label>
              <input
                type="range"
                min="0"
                max="12"
                value={srtSettings.shadowBlur}
                onChange={(e) => {
                  setSrtSettings({...srtSettings, shadowBlur: parseInt(e.target.value)});
                  forceSubtitleMode();
                }}
                className="w-full accent-green-500"
              />
            </div>
            
            {/* Subtitle Position (Height) */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">📄 {t('player.height')}: {srtSettings.bottomPosition}%</label>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={srtSettings.bottomPosition}
                onChange={(e) => {
                  setSrtSettings({...srtSettings, bottomPosition: parseInt(e.target.value)});
                  forceSubtitleMode();
                }}
                className="w-full accent-green-500"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => {
                    setSrtSettings({...srtSettings, bottomPosition: 8});
                    forceSubtitleMode();
                  }}
                  className="flex-1 px-2 py-1 rounded text-xs bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  {t('player.bottom')}
                </button>
                <button
                  onClick={() => {
                    setSrtSettings({...srtSettings, bottomPosition: 13});
                    forceSubtitleMode();
                  }}
                  className="flex-1 px-2 py-1 rounded text-xs bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  {t('player.middle')}
                </button>
                <button
                  onClick={() => {
                    setSrtSettings({...srtSettings, bottomPosition: 20});
                    forceSubtitleMode();
                  }}
                  className="flex-1 px-2 py-1 rounded text-xs bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  {t('player.top')}
                </button>
              </div>
            </div>

            {/* Text Color */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.textColor')}</label>
              <div className="flex gap-2 mb-2">
                {['#FFFFFF', '#FFFF00', '#00FF00', '#00FFFF', '#FF69B4', '#FFA500'].map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setSrtSettings({...srtSettings, color: color});
                      forceSubtitleMode();
                    }}
                    className={`w-8 h-8 rounded border-2 ${
                      srtSettings.color === color 
                        ? 'border-green-500' 
                        : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={srtSettings.color}
                  onChange={(e) => {
                    setSrtSettings({...srtSettings, color: e.target.value});
                    forceSubtitleMode();
                  }}
                  className="w-12 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={srtSettings.color}
                  onChange={(e) => {
                    setSrtSettings({...srtSettings, color: e.target.value});
                    forceSubtitleMode();
                  }}
                  className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-xs"
                />
              </div>
            </div>

            {/* Background Color */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{t('player.backgroundOpacity')}</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: t('player.dark'), value: 'rgba(0,0,0,0.9)' },
                  { label: t('player.medium'), value: 'rgba(0,0,0,0.75)' },
                  { label: t('player.light'), value: 'rgba(0,0,0,0.5)' },
                  { label: t('player.none'), value: 'rgba(0,0,0,0)' }
                ].map(bg => (
                  <button
                    key={bg.value}
                    onClick={() => {
                      setSrtSettings({...srtSettings, backgroundColor: bg.value});
                      forceSubtitleMode();
                    }}
                    className={`px-2 py-2 rounded text-xs border-2 ${
                      srtSettings.backgroundColor === bg.value 
                        ? 'border-green-500 bg-gray-700 text-white' 
                        : 'border-gray-600 bg-gray-800 text-gray-300'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>





            {/* Reset Button */}
            <button
              onClick={() => {
                setSrtSettings({
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  fontFamily: 'Arial',
                  strokeWidth: 2,
                  shadowBlur: 4,
                  bottomPosition: 13
                });
                forceSubtitleMode();
                toast.success('🔄 ' + t('player.settingsReset'), {
                  description: t('player.defaultSettings'),
                  duration: 2000
                });
              }}
              className="w-full mt-3 px-3 py-2 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all"
            >
              🔄 {t('player.resetSettings')}
            </button>
          </div>
        )}

        {/* QUALITY BADGE - SAĞ ÜST */}
        {upscaleAvailable && !showSettingsMenu && (
          <div className="absolute top-4 right-4 z-40">
            <div className={`px-2 py-0.5 rounded font-bold text-[10px] backdrop-blur-sm ${
              selectedQuality === '4K'
                ? 'bg-violet-600/90 text-white shadow-lg'
                : 'bg-blue-600/90 text-white'
            }`}>
              {selectedQuality === '4K' ? '⚡4K' : selectedQuality}
            </div>
          </div>
        )}
      </div>

      {/* Loading Spinner */}
      {!isPlaying && currentTime === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-300">{t('player.videoLoading')}</p>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-16 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        onMouseEnter={() => {
          setShowControls(true);
          clearTimeout(controlsTimeout);
        }}
        onMouseLeave={handleMouseMove}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div 
          ref={progressBarRef}
          className="relative w-full h-1.5 bg-gray-600 rounded-full cursor-pointer mb-4 group/progress"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div 
            className="absolute top-0 left-0 h-full bg-gray-500 rounded-full"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-violet-500 rounded-full group-hover/progress:bg-violet-400 transition-colors"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          {/* Hover indicator */}
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-violet-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              disabled={!subtitlesReady && subtitleSrc && !autoPlayTriggeredRef.current}
              className={`w-10 h-10 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 transition-colors ${
                !subtitlesReady && subtitleSrc && !autoPlayTriggeredRef.current ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={!subtitlesReady && subtitleSrc && !autoPlayTriggeredRef.current ? (t('player.waitingSubtitle') || 'Waiting for subtitles...') : ''}
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5 text-white" />
              ) : (
                <PlayIcon className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={toggleMute}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-violet-400 transition-colors"
              >
                {isMuted ? (
                  <SpeakerOffIcon className="w-5 h-5" />
                ) : (
                  <SpeakerLoudIcon className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 accent-violet-500"
              />
            </div>

            {/* Time */}
            <span className="text-white text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Audio + Subtitles + Settings - GRUP */}
            <div className="flex gap-1 relative">
              {/* Audio Track Button - Show if ANY audio tracks available */}
              {availableAudioTracks.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAudioTrackMenu(!showAudioTrackMenu);
                    }}
                    className="px-2 py-1.5 rounded text-xs font-bold transition-all bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                    title="Audio Tracks"
                  >
                    <span>🎵</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  
                  {/* Audio Track Dropdown */}
                  {showAudioTrackMenu && (
                                        <div className="audio-track-menu absolute bottom-full mb-2 right-0 bg-gray-900/98 backdrop-blur-md rounded-lg border-2 border-blue-500/50 shadow-2xl p-2 min-w-[220px] max-h-[400px] overflow-y-auto custom-scrollbar z-[100]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs text-blue-400 font-semibold mb-2 px-2 flex items-center justify-between">
                        <span>🎵 {t('player.audioTrack').toUpperCase()}</span>
                        <button 
                          onClick={() => setShowAudioTrackMenu(false)} 
                          className="text-gray-500 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-2 px-2">
                        {availableAudioTracks.length} {t('player.audioTrackCount')}
                      </div>
                      
                      {availableAudioTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => {
                            const video = videoRef.current;
                            const hls = hlsRef.current;
                            
                            // Tek track varsa sadece bilgi göster
                            if (availableAudioTracks.length === 1) {
                              setShowAudioTrackMenu(false);
                              toast.info(`🎵 ${track.title}`, {
                                description: `${t('player.singleAudioInMkv')}: ${track.language} - ${track.codec} ${track.channels || '2ch'}`,
                                duration: 4000
                              });
                              return;
                            }
                            
                            // HLS.js kullanıyorsa
                            if (useHls && hls) {
                              try {
                                hls.audioTrack = track.id;
                                setCurrentAudioTrack(track.id);
                                setShowAudioTrackMenu(false);
                                console.log('✅ HLS audio track changed to:', track.title, `(${track.language})`);
                                toast.success(`🎵 ${track.title}`, {
                                  description: `${t('player.audioChanged')}: ${track.language}`,
                                  duration: 2000
                                });
                                return;
                              } catch (err) {
                                console.error('❌ HLS audio switch failed:', err);
                              }
                            }
                            
                            // Native HTML5 AudioTracks API
                            if (video && video.audioTracks && video.audioTracks.length > 0) {
                              try {
                                // Disable all, enable selected
                                for (let i = 0; i < video.audioTracks.length; i++) {
                                  video.audioTracks[i].enabled = (i === track.id);
                                }
                                setCurrentAudioTrack(track.id);
                                setShowAudioTrackMenu(false);
                                console.log('✅ Native audio track changed to:', track.title, `(${track.language})`);
                                toast.success(`🎵 ${track.title}`, {
                                  description: `${t('player.audioChanged')}: ${track.language}`,
                                  duration: 2000
                                });
                                return;
                              } catch (err) {
                                console.warn('⚠️ Native audio switching failed:', err);
                              }
                            }
                            
                            // Fallback: AudioTracks API yok
                            setShowAudioTrackMenu(false);
                            toast.warning(t('player.audioSwitchNotSupported'), {
                              description: t('player.multiAudioNotSupported'),
                              duration: 5000,
                              action: {
                                label: t('player.openWithVlc'),
                                onClick: () => {
                                  // VLC launch implementasyonu
                                  console.log('Launch VLC...');
                                }
                              }
                            });
                          }}
                          className={`w-full px-3 py-2 rounded text-left text-sm transition-all mb-1 ${
                            currentAudioTrack === track.id
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">{track.title}</span>
                              {currentAudioTrack === track.id && <span className="text-xs">✓</span>}
                            </div>
                            <div className="text-xs opacity-70">
                              {track.language} • {track.codec} {track.channels}ch
                            </div>
                          </div>
                        </button>
                      ))}
                      
                      <div className="mt-2 pt-2 border-t border-gray-700 text-xs px-2">
                        {availableAudioTracks.length === 1 ? (
                          <div className="text-gray-400">
                            ℹ️ {t('player.singleAudioInfo')}
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            ⚠️ {t('player.useVlcMpv')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            
              {/* CC Button with dropdown */}
              {subtitleSrc && (
                <div className="relative subtitle-menu-btn">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      if (availableSubtitles.length > 0) {
                        // Has multiple subtitles - show menu
                        setShowSubtitleLanguageMenu(!showSubtitleLanguageMenu);
                        
                        // Auto-enable subtitle if not already enabled
                        if (!subtitlesEnabled) {
                          setSubtitlesEnabled(true);
                          const video = videoRef.current;
                          if (video && video.textTracks.length > 0) {
                            video.textTracks[0].mode = 'showing';
                            console.log('✅ Auto-enabled subtitle from menu click');
                          }
                        }
                      } else {
                        // Single subtitle - just toggle
                        toggleSubtitles();
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                      subtitlesEnabled
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                    title="Subtitles / Languages (C)"
                  >
                    <span>CC</span>
                    {availableSubtitles.length > 0 && <span className="text-[10px]">▼</span>}
                  </button>
                  
                  {/* Subtitle Track Dropdown Menu */}
                  {showSubtitleLanguageMenu && availableSubtitles.length > 0 && (
                    <div 
                      className="subtitle-lang-menu absolute bottom-full mb-2 right-0 bg-gray-900/98 backdrop-blur-md rounded-lg border-2 border-green-500/50 shadow-2xl p-2 min-w-[180px] z-[100]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs text-green-400 font-semibold mb-2 px-2">📝 {t('player.subtitle').toUpperCase()}</div>
                      
                      {/* Off option */}
                      <button
                        onClick={() => {
                          const video = videoRef.current;
                          if (video) {
                            // Aggressively disable ALL tracks
                            for (let i = 0; i < video.textTracks.length; i++) {
                              video.textTracks[i].mode = 'disabled';
                            }
                            // Force again after delay
                            setTimeout(() => {
                              for (let i = 0; i < video.textTracks.length; i++) {
                                video.textTracks[i].mode = 'disabled';
                              }
                            }, 50);
                          }
                          setSubtitlesEnabled(false);
                          setShowSubtitleLanguageMenu(false);
                          console.log('❌ All subtitles disabled');
                        }}
                        className={`w-full px-3 py-2 rounded text-left text-sm transition-all mb-1 ${
                          !subtitlesEnabled
                            ? 'bg-red-600 text-white font-semibold'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        ❌ {t('player.off')}
                      </button>
                      
                      {/* Available subtitle tracks */}
                      {availableSubtitles.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            const video = videoRef.current;
                            if (!video) return;
                            
                            console.log('🔄 Switching to subtitle:', sub.label, `(ID: ${sub.id})`);
                            
                            // Step 1: Disable ALL tracks immediately
                            for (let i = 0; i < video.textTracks.length; i++) {
                              video.textTracks[i].mode = 'disabled';
                            }
                            
                            // Step 2: Find target track
                            let targetTrackIndex = -1;
                            for (let i = 0; i < video.textTracks.length; i++) {
                              if (video.textTracks[i].label === sub.label) {
                                targetTrackIndex = i;
                                break;
                              }
                            }
                            
                            if (targetTrackIndex >= 0) {
                              // Step 3: Enable ONLY target track
                              video.textTracks[targetTrackIndex].mode = 'showing';
                              
                              console.log('✅ Subtitle changed to:', sub.label);
                              console.log('  Track index:', targetTrackIndex);
                              console.log('  Active tracks:', Array.from(video.textTracks).filter(t => t.mode === 'showing').map(t => t.label).join(', '));
                              
                              setCurrentSubtitleId(sub.id);
                              setSubtitlesEnabled(true);
                              setShowSubtitleLanguageMenu(false);
                              
                              toast.success(`📝 ${sub.label}`, {
                                description: `${t('player.subtitle')}: ${sub.language}`,
                                duration: 2000
                              });
                            } else {
                              console.error('❌ Track not found:', sub.label);
                              toast.error(t('player.subtitleChangeFailed'), {
                                description: t('player.trackNotFound'),
                                duration: 2000
                              });
                            }
                          }}
                          className={`w-full px-3 py-2 rounded text-left text-sm transition-all mb-1 ${
                            subtitlesEnabled && currentSubtitleId === sub.id
                              ? 'bg-green-600 text-white font-semibold'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{sub.label}</span>
                            <span className="text-[10px] opacity-70">{sub.language}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
                
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                }}
                className="px-2 py-1.5 rounded text-xs font-bold bg-gray-700 text-white hover:bg-gray-600 transition-all"
                title="Settings"
              >
                ⚙️
              </button>
            </div>
            
            {/* No subtitle but settings needed for quality selection */}
            {!subtitleSrc && upscaleAvailable && (
              <button
                                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsMenu(!showSettingsMenu);
                  }}
                className="px-2 py-1.5 rounded text-xs font-bold bg-gray-700 text-white hover:bg-gray-600 transition-all"
                title="Settings"
              >
                ⚙️
              </button>
            )}
            
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-violet-400 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <ExitFullScreenIcon className="w-5 h-5" />
              ) : (
                <EnterFullScreenIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className={`absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300 transition-opacity duration-300 border border-violet-500/30 ${
        showControls && !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="font-mono space-y-1">
          <div className="text-violet-400 font-bold mb-2">⌨️ {t('player.shortcuts').toUpperCase()}</div>
          <div><span className="text-violet-400">Space / K</span> - {t('player.playPause')}</div>
          <div><span className="text-violet-400">F</span> - {t('player.fullscreen')}</div>
          <div><span className="text-violet-400">C</span> - {t('player.subtitle')}</div>
          <div><span className="text-violet-400">M</span> - {t('player.mute')}</div>
          <div><span className="text-violet-400">← →</span> - {t('player.seek')} ±5s</div>
          <div><span className="text-violet-400">↑ ↓</span> - {t('player.volume')}</div>
          {availableAudioTracks.length > 1 && (
            <div className="mt-2 pt-2 border-t border-violet-500/30">
              <div className="text-yellow-400">🖱️ {t('player.rightClickTip') || 'Sağ tık → Audio/Subs'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}