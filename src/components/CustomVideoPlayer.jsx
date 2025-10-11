import { useRef, useState, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://zens23.onrender.com';

export default function CustomVideoPlayer({ 
  videoSrc, 
  subtitleSrc,
  magnet, // Torrent magnet URI
  filename, // Video dosya adı
  onTimeUpdate, 
  initialTime = 0,
  quality = '1080p',
  onQualityChange,
  upscaleAvailable = false,
  originalVideoSrc = null,
  availableQualities = ['480p', '720p', '1080p', '4K'],
  availableSubtitles = [], // [{src: '...', lang: 'en', label: 'English'}]
  availableAudioTracks = [], // [{label: '...', lang: 'en'}]
  onSubtitleChange,
  onAudioChange,
  isHls = false // DIRECT MKV streaming
}) {
  // 🚀 PERFORMANCE: Prefetch subtitle immediately when component mounts
  useEffect(() => {
    if (subtitleSrc) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = subtitleSrc;
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      console.log('🚀 Prefetching subtitle:', subtitleSrc);
      return () => document.head.removeChild(link);
    }
  }, [subtitleSrc]);
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(quality);
  const [error, setError] = useState(null);

  // Use videoSrc directly for MKV streaming
  const effectiveVideoSrc = videoSrc;

  // Initialize Video.js player
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
      'progressControl',
      'subtitlesButton',
      'fullscreenToggle'
    ];

    const player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: true,
      responsive: true,
      aspectRatio: '16:9',
      fill: false,
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
          enableLowInitialPlaylist: true,
          experimentalBufferBasedABR: true
        }
      },
      // Audio decode error fix
      techOrder: ['html5'],
      errorDisplay: false,
      // Prevent random seeking
      userActions: {
        hotkeys: function(event) {
          // Disable arrow keys for seeking to prevent accidental jumps
          if (event.which === 37 || event.which === 39) {
            event.preventDefault();
            return false;
          }
        }
      }
    });

    playerRef.current = player;
    player.addClass('vjs-modern-custom');
    
    player.bigPlayButton.on('click', () => {
      player.bigPlayButton.hide();
    });
    
    setIsReady(true);

    player.ready(() => {
      console.log('🎬 Video.js player ready!');
      
      // Force player dimensions immediately
      setTimeout(() => {
        player.dimensions('100%', '100%');
        player.fluid(true);
        console.log('📐 Forced player dimensions');
      }, 50);
      
      // Remove all unwanted overlay elements
      setTimeout(() => {
        const playerEl = player.el();
        const unwantedSelectors = [
          '.vjs-loading-spinner',
          '.vjs-error-display',
          '.vjs-modal-dialog',
          '.vjs-poster',
          '.vjs-text-track-settings',
          '.vjs-caption-settings',
          '.vjs-overlay'
        ];
        
        unwantedSelectors.forEach(selector => {
          const elements = playerEl.querySelectorAll(selector);
          elements.forEach(el => {
            if (el) {
              el.style.display = 'none';
              el.style.visibility = 'hidden';
              el.style.opacity = '0';
              el.remove();
            }
          });
        });
        
        console.log('🧹 Cleaned up overlay elements');
      }, 100);
      
      const videoEl = player.el().querySelector('video');

      if (effectiveVideoSrc) {
        if (isHls) {
          // HLS mode
          player.src({
            src: effectiveVideoSrc,
            type: 'application/x-mpegURL'
          });
          console.log('📼 HLS source set via Video.js');
        } else {
          // Direct MKV streaming - use native HTML5
          if (videoEl) {
            videoEl.src = effectiveVideoSrc;
            videoEl.load();
            console.log('📼 Direct MKV source set (native HTML5)');
          }
        }
      }

      if (initialTime > 0) {
        player.currentTime(initialTime);
        console.log('⏩ Jumped to:', initialTime, 's');
      }

      // Prevent random seeking issues
      let lastValidTime = 0;
      let seekingCount = 0;
      
      player.on('timeupdate', () => {
        const currentTime = player.currentTime();
        const duration = player.duration();
        
        // Detect abnormal seeking (jumping to start/end)
        if (Math.abs(currentTime - lastValidTime) > 10 && !player.seeking()) {
          seekingCount++;
          
          if (seekingCount > 2) {
            console.warn('⚠️ Abnormal seeking detected, correcting...');
            player.currentTime(lastValidTime);
            seekingCount = 0;
            return;
          }
        } else {
          seekingCount = 0;
        }
        
        lastValidTime = currentTime;
        
        if (onTimeUpdate) {
          onTimeUpdate(currentTime, duration);
        }
      });
      
      // Handle seeking events properly
      player.on('seeking', () => {
        console.log('🔍 Seeking to:', player.currentTime());
      });
      
      player.on('seeked', () => {
        console.log('✅ Seeked to:', player.currentTime());
        lastValidTime = player.currentTime();
      });

      player.on('play', () => {
        player.bigPlayButton.hide();
        console.log('▶️ Playing - Hide big play button');
      });
      player.on('pause', () => {
        if (player.currentTime() > 0) {
          player.bigPlayButton.show();
        }
      });
      player.on('loadstart', () => {
        player.bigPlayButton.show();
      });

      player.on('error', (e) => {
        console.error('❌ Player error:', e);
        if (videoEl && videoEl.error) {
          const errorCode = videoEl.error.code;
          const errorMsg = videoEl.error.message || 'Video oynatılamıyor';
          
          // Handle specific error codes
          if (errorCode === 3) {
            // MEDIA_ERR_DECODE - Audio/Video decode error
            console.warn('⚠️ Decode error detected, attempting recovery...');
            
            // Try to recover by reloading from current position
            const currentTime = player.currentTime();
            setTimeout(() => {
              if (videoEl) {
                videoEl.load();
                player.currentTime(currentTime);
                player.play().catch(err => console.log('Recovery play failed:', err));
              }
            }, 500);
            
            toast.warning('⚠️ Video hatası düzeltiliyor...', { duration: 3000 });
            return; // Don't show error UI for recoverable errors
          } else if (errorCode === 4) {
            // MEDIA_ERR_SRC_NOT_SUPPORTED
            if (isHls) {
              toast.error(`❌ HLS streaming failed. Try direct streaming instead.`, {
                description: 'The HLS stream is not available. Backend may not be ready.',
                duration: 8000
              });
            } else {
              setError('Video formatı desteklenmiyor');
            }
          } else {
            setError(errorMsg);
            toast.error(`❌ ${errorMsg}`, { duration: 5000 });
          }
        }
      });

      player.on('loadedmetadata', () => {
        console.log('📊 Metadata loaded');
        setError(null);
        
        // Force dimensions after metadata
        setTimeout(() => {
          player.dimensions('100%', '100%');
          player.fluid(true);
        }, 100);

        // 🔥 Add subtitles from backend if available
        if (availableSubtitles && availableSubtitles.length > 0) {
          console.log('📝 Adding subtitles from backend:', availableSubtitles);
          
          // Clear existing tracks completely
          const tracks = player.remoteTextTracks();
          for (let i = tracks.length - 1; i >= 0; i--) {
            player.removeRemoteTextTrack(tracks[i]);
          }
          
          // Clear text track display to prevent overlapping
          const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
          if (textTrackDisplay) {
            textTrackDisplay.innerHTML = '';
          }
          
          // Add all available subtitle tracks
          availableSubtitles.forEach((subtitle, index) => {
            const isFirst = index === 0;
            player.addRemoteTextTrack({
              src: subtitle.src,
              kind: 'subtitles',
              srclang: subtitle.lang || 'en',
              label: subtitle.label || `Subtitle ${index + 1}`,
              mode: isFirst ? 'showing' : 'disabled' // First subtitle enabled by default
            }, false);
            
            console.log(`✅ Subtitle track added: ${subtitle.label} (${subtitle.lang})`);
          });
          
          // Enable first subtitle after a delay
          setTimeout(() => {
            const textTracks = player.textTracks();
            if (textTracks.length > 0 && availableSubtitles.length > 0) {
              const firstSubLabel = availableSubtitles[0].label;
              for (let i = 0; i < textTracks.length; i++) {
                if (textTracks[i].label === firstSubLabel) {
                  textTracks[i].mode = 'showing';
                  console.log(`✅ ${firstSubLabel} subtitle enabled by default`);
                  break;
                }
              }
            }
          }, 500);

        } else if (subtitleSrc) {
          // Fallback: single subtitle from subtitleSrc prop
          console.log('📝 Adding single subtitle from subtitleSrc:', subtitleSrc);
          
          // Clear existing tracks
          const tracks = player.remoteTextTracks();
          for (let i = tracks.length - 1; i >= 0; i--) {
            player.removeRemoteTextTrack(tracks[i]);
          }
          
          const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
          if (textTrackDisplay) {
            textTrackDisplay.innerHTML = '';
          }
          
          player.addRemoteTextTrack({
            src: subtitleSrc,
            kind: 'subtitles',
            srclang: 'en',
            label: 'English',
            mode: 'showing'
          }, false);
          
          console.log('✅ Single subtitle track added (English)');
          
          setTimeout(() => {
            const textTracks = player.textTracks();
            for (let i = 0; i < textTracks.length; i++) {
              if (textTracks[i].label === 'English') {
                textTracks[i].mode = 'showing';
                console.log('✅ English subtitle enabled');
                break;
              }
            }
          }, 500);
        } else {
          console.log('⚠️ No subtitle source provided');
        }

      });

      player.on('canplaythrough', () => {
        console.log('💥 Ready to play...');
        
        // Final dimension fix
        player.dimensions('100%', '100%');
        player.fluid(true);
        
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
  }, [isHls]); // Removed subtitleSrc and availableSubtitles from dependencies

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
      // Direct MKV - use native HTML5
      const videoEl = player.el()?.querySelector('video');
      if (videoEl) {
        videoEl.src = effectiveVideoSrc;
        videoEl.load();
      }
    }
    
    setError(null);
  }, [effectiveVideoSrc, isHls]);

  // Separate effect for subtitle updates
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    if (availableSubtitles && availableSubtitles.length > 0) {
      console.log('🔄 Updating subtitles:', availableSubtitles);
      
      // Clear existing tracks completely
      const tracks = player.remoteTextTracks();
      for (let i = tracks.length - 1; i >= 0; i--) {
        player.removeRemoteTextTrack(tracks[i]);
      }
      
      // Clear text track display to prevent overlapping subtitles
      const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
      if (textTrackDisplay) {
        textTrackDisplay.innerHTML = '';
        console.log('🧹 Cleared subtitle display');
      }
      
      // Add all subtitle tracks
      availableSubtitles.forEach((subtitle, index) => {
        const isFirst = index === 0;
        player.addRemoteTextTrack({
          src: subtitle.src,
          kind: 'subtitles',
          srclang: subtitle.lang || 'en',
          label: subtitle.label || `Subtitle ${index + 1}`,
          mode: isFirst ? 'showing' : 'disabled'
        }, false);
        
        console.log(`✅ Subtitle track added: ${subtitle.label}`);
      });
      
      // Enable first subtitle after delay
      setTimeout(() => {
        const textTracks = player.textTracks();
        if (textTracks.length > 0 && availableSubtitles.length > 0) {
          const firstSubLabel = availableSubtitles[0].label;
          for (let i = 0; i < textTracks.length; i++) {
            if (textTracks[i].label === firstSubLabel) {
              textTracks[i].mode = 'showing';
              console.log(`✅ ${firstSubLabel} enabled`);
              if (onSubtitleChange) {
                onSubtitleChange(availableSubtitles[0]);
              }
              break;
            }
          }
        }
      }, 500);
    } else if (subtitleSrc) {
      // Fallback: single subtitle
      console.log('🔄 Updating single subtitle:', subtitleSrc);
      
      const tracks = player.remoteTextTracks();
      for (let i = tracks.length - 1; i >= 0; i--) {
        player.removeRemoteTextTrack(tracks[i]);
      }
      
      const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
      if (textTrackDisplay) {
        textTrackDisplay.innerHTML = '';
      }
      
      player.addRemoteTextTrack({
        src: subtitleSrc,
        kind: 'subtitles',
        srclang: 'en',
        label: 'English',
        mode: 'showing'
      }, false);
      
      console.log('✅ Single subtitle track added');
      
      setTimeout(() => {
        const textTracks = player.textTracks();
        for (let i = 0; i < textTracks.length; i++) {
          if (textTracks[i].label === 'English') {
            textTracks[i].mode = 'showing';
            console.log('✅ English subtitle enabled');
            if (onSubtitleChange) {
              onSubtitleChange({ src: subtitleSrc, label: 'English', lang: 'en' });
            }
            break;
          }
        }
      }, 500);
    } else {
      // No subtitle source, disable all tracks
      const textTracks = player.textTracks();
      for (let i = 0; i < textTracks.length; i++) {
        textTracks[i].mode = 'disabled';
      }
      
      // Clear display
      const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
      if (textTrackDisplay) {
        textTrackDisplay.innerHTML = '';
      }
      
      if (onSubtitleChange) onSubtitleChange(null);
    }
  }, [subtitleSrc, availableSubtitles]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    console.log('🔊 Available audio tracks:', availableAudioTracks);

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

  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const handleTextTrackChange = () => {
      const textTracks = player.textTracks();
      console.log('📝 Text track changed, total tracks:', textTracks.length);
      
      let hasActiveTrack = false;
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        console.log(`Track ${i}: ${track.label} - mode: ${track.mode}`);
        
        if (track.mode === 'showing') {
          hasActiveTrack = true;
          console.log('✅ Active subtitle:', track.label);
          const sub = availableSubtitles.find(s => s.label === track.label);
          if (sub && onSubtitleChange) {
            onSubtitleChange(sub);
          }
          break; // Exit loop once we find active track
        }
      }
      
      // No active track - user selected Off or disabled
      if (!hasActiveTrack) {
        console.log('❌ User manually disabled subtitle (Off selected)');
        
        // Clear subtitle display immediately
        const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');
        if (textTrackDisplay) {
          textTrackDisplay.innerHTML = '';
          console.log('🧹 Cleared subtitle display after Off selection');
        }
        
        if (onSubtitleChange) {
          onSubtitleChange(null);
        }
      }
    };

    player.on('texttrackchange', handleTextTrackChange);
    
    // Also listen to mode changes
    const textTracks = player.textTracks();
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].addEventListener('modechange', handleTextTrackChange);
    }
    
    // Handle subtitle button click to toggle menu
    setTimeout(() => {
      const subtitlesButton = player.controlBar.getChild('SubsCapsButton') || player.controlBar.getChild('subtitlesButton');
      if (subtitlesButton) {
        const buttonEl = subtitlesButton.el();
        const menu = subtitlesButton.menu;
        
        if (!menu) return;
        
        // Track menu state
        let isMenuOpen = false;
        
        // Override handleClick method to prevent default behavior
        subtitlesButton.handleClick = function(event) {
          event.preventDefault();
          event.stopPropagation();
          
          const menuEl = menu.el();
          
          if (isMenuOpen) {
            // Close menu
            menu.unlockShowing();
            menu.hide();
            menuEl.style.display = 'none';
            menuEl.style.visibility = 'hidden';
            menuEl.style.opacity = '0';
            subtitlesButton.removeClass('vjs-hover');
            isMenuOpen = false;
            console.log('🔽 Subtitle menu closed');
          } else {
            // Open menu
            menu.lockShowing();
            menu.show();
            menuEl.style.display = 'block';
            menuEl.style.visibility = 'visible';
            menuEl.style.opacity = '1';
            subtitlesButton.addClass('vjs-hover');
            isMenuOpen = true;
            console.log('🔼 Subtitle menu opened');
          }
        };
        
        // Close menu when clicking outside
        player.on('click', (e) => {
          if (isMenuOpen && !buttonEl.contains(e.target)) {
            const menuEl = menu.el();
            menu.unlockShowing();
            menu.hide();
            menuEl.style.display = 'none';
            menuEl.style.visibility = 'hidden';
            menuEl.style.opacity = '0';
            subtitlesButton.removeClass('vjs-hover');
            isMenuOpen = false;
            console.log('🔽 Subtitle menu closed (outside click)');
          }
        });
        
        // Close menu after selecting an item
        const menuItems = menu.el().querySelectorAll('.vjs-menu-item');
        menuItems.forEach(item => {
          item.addEventListener('click', (e) => {
            setTimeout(() => {
              const menuEl = menu.el();
              menu.unlockShowing();
              menu.hide();
              menuEl.style.display = 'none';
              menuEl.style.visibility = 'hidden';
              menuEl.style.opacity = '0';
              subtitlesButton.removeClass('vjs-hover');
              isMenuOpen = false;
              console.log('✅ Subtitle selected, menu closed');
            }, 50);
          });
        });
      }
    }, 1000);
    
    return () => {
      player.off('texttrackchange', handleTextTrackChange);
      const tracks = player.textTracks();
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].removeEventListener('modechange', handleTextTrackChange);
      }
    };
  }, [availableSubtitles, onSubtitleChange]);

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
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
      <div data-vjs-player className="w-full h-full">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-modern-custom"
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
        /* Hide ALL Video.js overlays, spinners, and black boxes */
        .vjs-modern-custom .vjs-loading-spinner,
        .vjs-modern-custom .vjs-error-display,
        .vjs-modern-custom .vjs-modal-dialog,
        .vjs-modern-custom .vjs-modal-dialog-content,
        .vjs-modern-custom .vjs-poster,
        .vjs-modern-custom .vjs-text-track-settings,
        .vjs-modern-custom .vjs-caption-settings,
        .vjs-modern-custom .vjs-overlay,
        .vjs-modern-custom .vjs-waiting,
        .vjs-modern-custom .vjs-seeking {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        .vjs-modern-custom {
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
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          background: #000 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .vjs-modern-custom .vjs-tech {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          display: block !important;
          object-fit: contain !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          z-index: 1 !important;
        }
        .vjs-modern-custom video {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          object-fit: contain !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          z-index: 1 !important;
          background: #000 !important;
        }
        
        /* Hide any black boxes or overlays */
        .vjs-modern-custom .vjs-text-track-display::before,
        .vjs-modern-custom .vjs-text-track-display::after {
          display: none !important;
        }
        .vjs-modern-custom .vjs-big-play-button {
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
        .vjs-modern-custom .vjs-big-play-button:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 15px 50px rgba(139, 92, 246, 0.7) !important;
          background: linear-gradient(135deg, #a78bfa, #c4b5fd) !important;
        }
        .vjs-modern-custom.vjs-playing .vjs-big-play-button,
        .vjs-modern-custom.vjs-ended .vjs-big-play-button {
          display: none !important;
        }
        .vjs-modern-custom .vjs-control-bar {
          background: linear-gradient(to top, rgba(0,0,0,0.95), transparent) !important;
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(139, 92, 246, 0.2);
          display: flex !important;
          visibility: visible !important;
          z-index: 10 !important;
          position: absolute !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
        }
        .vjs-modern-custom .vjs-control {
          border-radius: 12px !important;
          margin-right: 10px !important;
          background: rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
          display: inline-block !important;
        }
        .vjs-modern-custom .vjs-control:hover {
          background: rgba(139, 92, 246, 0.2) !important;
          transform: scale(1.05);
        }
        .vjs-modern-custom .vjs-progress-control .vjs-progress-holder {
          background: rgba(255,255,255,0.1) !important;
          border-radius: 10px;
          height: 8px !important;
        }
        .vjs-modern-custom .vjs-play-progress {
          background: linear-gradient(to right, #8b5cf6, #a78bfa) !important;
          border-radius: 10px;
        }
        .vjs-modern-custom .vjs-volume-panel .vjs-volume-control {
          width: 70px !important;
        }
        .vjs-modern-custom .vjs-menu-button .vjs-menu .vjs-menu-content {
          background: rgba(0,0,0,0.95) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(139, 92, 246, 0.3);
          min-width: 150px !important;
        }
        .vjs-modern-custom .vjs-menu-item {
          color: white !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          transition: background 0.2s;
          display: block !important;
        }
        .vjs-modern-custom .vjs-menu-item:hover {
          background: rgba(139, 92, 246, 0.3) !important;
        }
        .vjs-modern-custom .vjs-subtitles-button,
        .vjs-modern-custom .vjs-subs-caps-button,
        .vjs-modern-custom .vjs-audio-button {
          color: #8b5cf6 !important;
          background: rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
        }
        .vjs-modern-custom .vjs-subtitles-button:hover,
        .vjs-modern-custom .vjs-subs-caps-button:hover,
        .vjs-modern-custom .vjs-audio-button:hover {
          background: rgba(139, 92, 246, 0.2) !important;
        }
        .vjs-modern-custom .vjs-subtitles-button .vjs-menu {
          display: block !important;
        }
        .video-js {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          visibility: visible !important;
        }
        .vjs-modern-custom .vjs-text-track-display {
          position: absolute !important;
          bottom: 4em !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          text-align: center !important;
          font-size: 18px !important;
          z-index: 5 !important;
          pointer-events: none !important;
        }
        .vjs-modern-custom .vjs-text-track-display > div {
          position: relative !important;
          width: 100% !important;
          text-align: center !important;
          min-height: 2em !important;
        }
        .vjs-modern-custom .vjs-text-track-display div[style*="display: none"] {
          display: none !important;
        }
        .vjs-modern-custom .vjs-text-track-cue {
          display: inline-block !important;
          position: relative !important;
        }
        .vjs-modern-custom .vjs-text-track-cue > div {
          display: inline-block !important;
        }
        .vjs-modern-custom .vjs-text-track {
          font-size: 20px !important;
          color: white !important;
          background-color: rgba(0, 0, 0, 0.85) !important;
          font-family: Arial, Helvetica, sans-serif !important;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9) !important;
          padding: 0.3em 0.6em !important;
          border-radius: 4px !important;
          display: inline-block !important;
          white-space: pre-wrap !important;
          line-height: 1.5 !important;
          font-weight: 600 !important;
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