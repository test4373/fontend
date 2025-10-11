import { useRef, useState, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://zens23.onrender.com';

export default function DashVideoPlayer({ 
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
  isHls = false
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(quality);
  const [error, setError] = useState(null);
  const [subtitleLoaded, setSubtitleLoaded] = useState(false);

  const effectiveVideoSrc = videoSrc;

  // 🚀 RAM OPTIMIZATION: Initialize Video.js with minimal memory footprint
  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    if (!videoElement.id) {
      videoElement.id = `vjs-player-${Date.now()}`;
    }
    
    const controlBarChildren = [
      'playToggle',
      'volumePanel',
      'currentTimeDisplay',
      'timeDivider',
      'durationDisplay',
      'progressControl'
    ];
    
    if (availableSubtitles.length > 0) {
      controlBarChildren.push('subtitlesButton');
    }
    
    if (availableAudioTracks.length > 0) {
      controlBarChildren.push('audioTrackButton');
    }
    
    controlBarChildren.push('fullscreenToggle');

    // 🔥 RAM OPTIMIZED CONFIG
    const player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'metadata', // 🚀 Only metadata - saves RAM
      fluid: true,
      responsive: true,
      liveui: false,
      controlBar: {
        children: controlBarChildren
      },
      html5: {
        nativeTextTracks: true,
        nativeAudioTracks: true,
        vhs: {
          overrideNative: !isHls,
          withCredentials: false,
          handleManifestRedirects: false,
          useDevicePixelRatio: true,
          smoothQualityChange: true,
          // ���� RAM OPTIMIZATION: Limit buffer size
          maxBufferLength: 30, // Only buffer 30 seconds ahead
          maxMaxBufferLength: 60, // Max 60 seconds total
          maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
          maxBufferHole: 0.5, // Fill small gaps
          highWaterMark: 0, // Disable extra buffering
        }
      },
      // 🔥 DASH.js integration for better subtitle support
      techOrder: ['html5'],
      sources: []
    });

    playerRef.current = player;
    player.addClass('vjs-dash-custom');
    
    player.bigPlayButton.on('click', () => {
      player.bigPlayButton.hide();
    });
    
    setIsReady(true);

    player.ready(() => {
      console.log('🎬 DASH Player ready!');
      
      const videoEl = player.el().querySelector('video');

      // Set video source
      if (effectiveVideoSrc) {
        if (isHls) {
          player.src({
            src: effectiveVideoSrc,
            type: 'application/x-mpegURL'
          });
          console.log('📼 HLS source set');
        } else {
          // Direct MKV streaming
          if (videoEl) {
            videoEl.src = effectiveVideoSrc;
            videoEl.load();
            console.log('📼 Direct MKV source set');
          }
        }
      }

      // Jump to initial time
      if (initialTime > 0) {
        player.currentTime(initialTime);
        console.log('⏩ Jumped to:', initialTime, 's');
      }

      // Time update handler
      player.on('timeupdate', () => {
        if (onTimeUpdate) {
          onTimeUpdate(player.currentTime(), player.duration());
        }
      });

      // Play/pause handlers
      player.on('play', () => {
        player.bigPlayButton.hide();
      });
      
      player.on('pause', () => {
        if (player.currentTime() > 0) {
          player.bigPlayButton.show();
        }
      });
      
      player.on('loadstart', () => {
        player.bigPlayButton.show();
      });

      // Error handler
      player.on('error', (e) => {
        console.error('❌ Player error:', e);
        if (videoEl && videoEl.error) {
          const msg = videoEl.error.message || 'Video oynatılamıyor';
          setError(msg);
          toast.error(`❌ ${msg}`);
        }
      });

      // 🔥 SUBTITLE LOADING - After metadata loaded
      player.on('loadedmetadata', () => {
        console.log('📊 Metadata loaded');
        setError(null);

        // 🚀 Load subtitles AFTER video is ready
        if (subtitleSrc && !subtitleLoaded) {
          console.log('📝 Loading subtitle from:', subtitleSrc);
          
          // Add subtitle track directly
          try {
            player.addRemoteTextTrack({
              src: subtitleSrc,
              kind: 'subtitles',
              srclang: 'en',
              label: 'English',
              default: true,
              mode: 'showing'
            }, false);
            
            console.log('✅ Subtitle track added');
            setSubtitleLoaded(true);
            
            // Force enable subtitle on playing
            player.on('playing', () => {
            const textTracks = player.textTracks();
            for (let i = 0; i < textTracks.length; i++) {
            if (textTracks[i].kind === 'subtitles') {
            textTracks[i].mode = 'showing';
            console.log('✅ Subtitle enabled on play:', textTracks[i].label);
            }
            }
            });
          } catch (err) {
            console.error('❌ Failed to add subtitle:', err);
          }
        } else if (availableSubtitles.length > 0 && !subtitleLoaded) {
          console.log('📝 Loading subtitles from array...');
          loadSubtitles(player);
          setSubtitleLoaded(true);
        }
      });

      // Auto-play when ready
      player.on('canplaythrough', () => {
        console.log('💥 Ready to play...');
        player.play().catch(err => {
          toast.info('🎬 ' + (t('player.clickToPlay') || 'Click to play'), { duration: 2000 });
        });
      });
    });

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
      }
    };
  }, [isHls]);

  // 🔥 SUBTITLE LOADER - Separate function for better control
  const loadSubtitles = (player) => {
    if (!player || player.isDisposed()) return;

    // Clear existing tracks
    const tracks = player.remoteTextTracks();
    for (let i = tracks.length - 1; i >= 0; i--) {
      player.removeRemoteTextTrack(tracks[i]);
    }

    // Add new tracks
    availableSubtitles.forEach((sub, index) => {
      const isDefault = sub.src === subtitleSrc || index === 0;
      
      try {
        player.addRemoteTextTrack({
          src: sub.src,
          kind: 'subtitles',
          srclang: sub.lang || 'en',
          label: sub.label || `Subtitle ${index + 1}`,
          default: isDefault,
          mode: isDefault ? 'showing' : 'disabled'
        }, false);
        
        console.log('📝 Added subtitle:', sub.label, isDefault ? '(default)' : '');
      } catch (err) {
        console.error('❌ Failed to add subtitle:', err);
      }
    });

    // Enable default subtitle
    const defaultSub = availableSubtitles.find(s => s.src === subtitleSrc) || availableSubtitles[0];
    if (defaultSub) {
      const textTracks = player.textTracks();
      for (let i = 0; i < textTracks.length; i++) {
        if (textTracks[i].label === defaultSub.label) {
          textTracks[i].mode = 'showing';
          console.log('📝 Default subtitle enabled:', defaultSub.label);
          if (onSubtitleChange) onSubtitleChange(defaultSub);
          break;
        }
      }
    }
  };

  // Update video source when changed
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !effectiveVideoSrc || player.isDisposed()) return;

    console.log('🔄 Updating video source:', effectiveVideoSrc);
    
    if (isHls) {
      player.src({
        src: effectiveVideoSrc,
        type: 'application/x-mpegURL'
      });
    } else {
      const videoEl = player.el().querySelector('video');
      if (videoEl) {
        videoEl.src = effectiveVideoSrc;
        videoEl.load();
      }
    }
    
    setError(null);
    setSubtitleLoaded(false); // Reset subtitle loading
  }, [effectiveVideoSrc, isHls]);

  // Update subtitles when changed
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed() || availableSubtitles.length === 0) return;

    if (subtitleLoaded) {
      loadSubtitles(player);
    }
  }, [availableSubtitles, subtitleSrc]);

  // Audio track change handler
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    if (availableAudioTracks.length > 0) {
      const defaultAudio = availableAudioTracks[0];
      const audioList = player.audioTracks();
      for (let i = 0; i < audioList.length; i++) {
        if (audioList[i].label === defaultAudio.label) {
          audioList[i].enabled = true;
          if (onAudioChange) onAudioChange(defaultAudio);
          break;
        }
      }
    }
  }, [availableAudioTracks, onAudioChange]);

  // Subtitle change listener
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const handleTextTrackChange = () => {
      const activeTrack = Array.from(player.textTracks()).find(track => track.mode === 'showing');
      if (activeTrack && activeTrack.kind === 'subtitles') {
        const sub = availableSubtitles.find(s => s.label === activeTrack.label);
        if (sub && onSubtitleChange) onSubtitleChange(sub);
      } else if (onSubtitleChange) {
        onSubtitleChange(null);
      }
    };

    player.on('texttrackchange', handleTextTrackChange);
    return () => player.off('texttrackchange', handleTextTrackChange);
  }, [availableSubtitles, onSubtitleChange]);

  // Audio track change listener
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const handleAudioTrackChange = () => {
      const activeAudio = Array.from(player.audioTracks()).find(track => track.enabled);
      if (activeAudio) {
        const audio = availableAudioTracks.find(a => a.label === activeAudio.label);
        if (audio && onAudioChange) onAudioChange(audio);
      }
    };

    player.on('change', handleAudioTrackChange);
    return () => player.off('change', handleAudioTrackChange);
  }, [availableAudioTracks, onAudioChange]);

  const handleQualityChange = (newQuality) => {
    setCurrentQuality(newQuality);
    if (onQualityChange) {
      onQualityChange(newQuality);
    }
    toast.success(`🎥 Kalite: ${newQuality}`);
  };

  return (
    <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden shadow-2xl">
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-dash-custom"
          playsInline
          crossOrigin="anonymous"
        />
      </div>

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

      <style>{`
        .vjs-dash-custom {
          --vjs-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --vjs-color: #8b5cf6;
          --vjs-playlist-color: #8b5cf6;
          --vjs-button-color: #8b5cf6;
          --vjs-progress-color: #8b5cf6;
          --vjs-volume-level-color: #8b5cf6;
          --vjs-volume-panel-color: #8b5cf6;
          --vjs-control-bar-bg: rgba(0, 0, 0, 0.9);
          --vjs-control-bar-box-shadow: 0 -4px 20px rgba(139, 92, 246, 0.3);
          --vjs-control-bar-height: 70px;
          --vjs-big-play-button-bg: linear-gradient(135deg, #8b5cf6, #a78bfa);
          --vjs-big-play-button-hover-bg: linear-gradient(135deg, #a78bfa, #c4b5fd);
          --vjs-font-size: 1rem;
          border-radius: 16px;
          width: 100% !important;
          height: 100% !important;
          background: #000 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .vjs-dash-custom .vjs-tech {
          border-radius: 16px !important;
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        .vjs-dash-custom .vjs-big-play-button {
          font-size: 4rem !important;
          border-radius: 50% !important;
          width: 100px !important;
          height: 100px !important;
          margin-left: -50px !important;
          margin-top: -50px !important;
          background: linear-gradient(135deg, #8b5cf6, #a78bfa) !important;
          border: none !important;
          box-shadow: 0 10px 40px rgba(139, 92, 246, 0.5) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          backdrop-filter: blur(10px);
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          visibility: visible !important;
          z-index: 2;
        }
        .vjs-dash-custom .vjs-big-play-button:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 15px 50px rgba(139, 92, 246, 0.7) !important;
          background: linear-gradient(135deg, #a78bfa, #c4b5fd) !important;
        }
        .vjs-dash-custom.vjs-playing .vjs-big-play-button,
        .vjs-dash-custom.vjs-ended .vjs-big-play-button {
          display: none !important;
        }
        .vjs-dash-custom .vjs-control-bar {
          background: linear-gradient(to top, rgba(0,0,0,0.95), transparent) !important;
          border-radius: 0 0 16px 16px !important;
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(139, 92, 246, 0.2);
          display: flex !important;
          visibility: visible !important;
        }
        .vjs-dash-custom .vjs-control {
          border-radius: 12px !important;
          margin-right: 10px !important;
          background: rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
          display: inline-block !important;
        }
        .vjs-dash-custom .vjs-control:hover {
          background: rgba(139, 92, 246, 0.2) !important;
          transform: scale(1.05);
        }
        .vjs-dash-custom .vjs-progress-control .vjs-progress-holder {
          background: rgba(255,255,255,0.1) !important;
          border-radius: 10px;
          height: 8px !important;
        }
        .vjs-dash-custom .vjs-play-progress {
          background: linear-gradient(to right, #8b5cf6, #a78bfa) !important;
          border-radius: 10px;
        }
        .vjs-dash-custom .vjs-volume-panel .vjs-volume-control {
          width: 70px !important;
        }
        .vjs-dash-custom .vjs-menu-button .vjs-menu .vjs-menu-content {
          background: rgba(0,0,0,0.95) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(139, 92, 246, 0.3);
          min-width: 150px !important;
        }
        .vjs-dash-custom .vjs-menu-item {
          color: white !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          transition: background 0.2s;
          display: block !important;
        }
        .vjs-dash-custom .vjs-menu-item:hover {
          background: rgba(139, 92, 246, 0.3) !important;
        }
        .vjs-dash-custom .vjs-subtitles-button,
        .vjs-dash-custom .vjs-audio-track-button {
          color: #8b5cf6 !important;
          background: rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
        }
        .vjs-dash-custom .vjs-subtitles-button:hover,
        .vjs-dash-custom .vjs-audio-track-button:hover {
          background: rgba(139, 92, 246, 0.2) !important;
        }
        .video-js {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          visibility: visible !important;
        }
        /* 🔥 SUBTITLE STYLING - Better visibility */
        .vjs-dash-custom .vjs-text-track-display {
          bottom: 4em !important;
          pointer-events: none !important;
        }
        .vjs-dash-custom .vjs-text-track-cue {
          background-color: rgba(0, 0, 0, 0.8) !important;
          color: white !important;
          font-size: 1.2em !important;
          font-family: Arial, sans-serif !important;
          text-shadow: 2px 2px 4px black !important;
          padding: 0.2em 0.4em !important;
          border-radius: 4px !important;
          line-height: 1.4 !important;
        }
        .vjs-dash-custom .vjs-text-track-cue > div {
          background-color: transparent !important;
        }
      `}</style>

      {availableQualities.length > 1 && isReady && !error && (
        <div className="absolute bottom-20 left-4 z-20">
          <select 
            value={currentQuality} 
            onChange={(e) => handleQualityChange(e.target.value)}
            className="bg-black/80 backdrop-blur-md text-white border border-violet-500/50 rounded-lg px-3 py-2 text-sm font-medium outline-none hover:border-violet-400 transition-colors"
          >
            {availableQualities.map(q => (
              <option key={q} value={q} className="bg-gray-800 text-white">
                {q}
              </option>
            ))}
          </select>
        </div>
      )}

      {upscaleAvailable && isReady && !error && (
        <div className="absolute top-4 left-4 z-10">
          <div className="px-3 py-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold shadow-lg backdrop-blur-sm">
            {currentQuality === '4K' ? '⚡ 4K Upscale' : currentQuality}
          </div>
        </div>
      )}
    </div>
  );
}
