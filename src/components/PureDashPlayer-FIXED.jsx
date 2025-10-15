import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function PureDashPlayer({ 
  videoSrc, 
  subtitleSrc,
  onTimeUpdate, 
  initialTime = 0,
  quality = '1080p',
  onQualityChange,
  availableQualities = ['480p', '720p', '1080p'],
  availableSubtitles = [],
  availableAudioTracks = [],
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const subtitleMenuRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    video.src = videoSrc;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onTimeUpdate) onTimeUpdate(video.currentTime, video.duration || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (initialTime > 5) video.currentTime = initialTime;
    };
    
    const handleCanPlayThrough = () => {
      // FIXED: Load subtitles when video is fully ready
      console.log('🎬 Video ready, loading subtitles...');
      
      const tracks = video.querySelectorAll('track');
      tracks.forEach(t => t.remove());

      if (availableSubtitles.length > 0) {
        console.log('📝 Adding', availableSubtitles.length, 'subtitles');
        
        availableSubtitles.forEach((sub, i) => {
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.label;
          track.srclang = sub.lang || 'en';
          track.src = sub.src;
          if (i === 0) {
            track.default = true;
            track.mode = 'showing';
          }
          // Re-assert showing on load events to avoid disappearing
          track.addEventListener('load', () => {
            try {
              const tt = Array.from(video.textTracks).find(t => t.label === sub.label);
              if (tt && (i === 0 || currentSubtitle?.label === sub.label)) {
                tt.mode = 'showing';
              }
            } catch {}
          });
          video.appendChild(track);
          console.log('➕ Added:', sub.label);
        });

        // Force enable first subtitle
        setTimeout(() => {
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = i === 0 ? 'showing' : 'disabled';
          }
          setCurrentSubtitle(availableSubtitles[0]);
          console.log('✅ Subtitle enabled:', availableSubtitles[0].label);
          toast.success('📝 ' + availableSubtitles[0].label, { duration: 2000 });
        }, 100);
      } else if (subtitleSrc) {
        console.log('📝 Adding single subtitle');
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = 'Default';
        track.srclang = 'en';
        track.src = subtitleSrc;
        track.default = true;
        track.mode = 'showing';
        track.addEventListener('load', () => {
          try {
            const tt = Array.from(video.textTracks).find(t => t.label === 'Default');
            if (tt) tt.mode = 'showing';
          } catch {}
        });
        video.appendChild(track);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setBuffering(true);
    const handleCanPlay = () => {
      setBuffering(false);
      video.play().catch(() => {});
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('loadeddata', handleCanPlayThrough);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('loadeddata', handleCanPlayThrough);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoSrc, initialTime, availableSubtitles, subtitleSrc]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubtitleChange = (sub) => {
    const video = videoRef.current;
    if (!video) return;

    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'disabled';
    }

    if (sub) {
      for (let i = 0; i < video.textTracks.length; i++) {
        if (video.textTracks[i].label === sub.label) {
          video.textTracks[i].mode = 'showing';
          // Guard: re-assert showing shortly after selection
          setTimeout(() => {
            try { video.textTracks[i].mode = 'showing'; } catch {}
          }, 300);
          setCurrentSubtitle(sub);
          toast.success(`📝 ${sub.label}`, { duration: 1000 });
          break;
        }
      }
    } else {
      setCurrentSubtitle(null);
      toast.info('📝 Altyazı Kapalı', { duration: 1000 });
    }
    setShowSubtitleMenu(false);
  };

  return (
    <div className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden">
      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          font-size: 1.5em;
          font-family: Arial, sans-serif;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
        }
      `}</style>
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        crossOrigin="anonymous"
        preload="auto"
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-violet-500"></div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-4 z-10">
        <div 
          className="w-full h-1 bg-gray-600 rounded-full cursor-pointer mb-3 hover:h-2 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (videoRef.current) videoRef.current.currentTime = pos * duration;
          }}
        >
          <div 
            className="h-full bg-violet-500 rounded-full"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (videoRef.current) {
                  if (isPlaying) videoRef.current.pause();
                  else videoRef.current.play();
                }
              }}
              className="text-2xl hover:text-violet-400 transition p-2"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            <span className="text-sm font-medium bg-black/40 px-3 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }}
              className="text-xl hover:text-violet-400 transition p-2"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {availableSubtitles.length > 0 && (
              <div className="relative" ref={subtitleMenuRef}>
                <button
                  onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                  className="text-sm hover:text-violet-400 transition px-3 py-2 hover:bg-white/10 rounded-lg font-medium"
                >
                  📝 {currentSubtitle ? currentSubtitle.label.split(' ')[0] : 'Altyazı'}
                </button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg border border-violet-500/30 p-2 min-w-[200px] shadow-2xl">
                    <div className="text-xs text-gray-400 mb-2 font-bold px-2">📝 ALTYAZI</div>
                    <button
                      onClick={() => handleSubtitleChange(null)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition mb-1 ${
                        !currentSubtitle ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                      }`}
                    >
                      ❌ Kapalı
                    </button>
                    {availableSubtitles.map((sub, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubtitleChange(sub)}
                        className={`w-full text-left px-3 py-2 rounded text-xs transition ${
                          currentSubtitle?.label === sub.label ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
