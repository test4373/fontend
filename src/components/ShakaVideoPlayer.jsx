import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function ShakaVideoPlayer({ 
  videoSrc, 
  subtitleSrc,
  onTimeUpdate, 
  initialTime = 0,
  animeId = null,
  episodeNumber = null,
}) {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [selectedSubTrack, setSelectedSubTrack] = useState(0);

  // Initialize Shaka Player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if Shaka is loaded
    if (!window.shaka) {
      setError('Shaka Player yüklenmedi');
      return;
    }

    // Install polyfills
    window.shaka.polyfill.installAll();

    // Check browser support
    if (!window.shaka.Player.isBrowserSupported()) {
      setError('Tarayıcınız desteklenmiyor');
      return;
    }

    // Create player
    const player = new window.shaka.Player(video);
    playerRef.current = player;

    console.log('✅ Shaka Player initialized');

    // Error handling
    player.addEventListener('error', (event) => {
      console.error('❌ Shaka Error:', event.detail);
      setError(event.detail?.message || 'Playback error');
      setIsLoading(false);
    });

    // Track changes
    player.addEventListener('trackschanged', () => {
      const tracks = player.getTextTracks();
      console.log('📝 Text tracks:', tracks);
      setSubtitles(tracks);
      
      // Enable first subtitle by default
      if (tracks.length > 0) {
        player.selectTextTrack(tracks[0]);
        player.setTextTrackVisibility(true);
      }
    });

    return () => {
      player.destroy();
    };
  }, []);

  // Load video source
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoSrc) return;

    console.log('🔄 Loading video:', videoSrc);
    setIsLoading(true);
    setError(null);

    player.load(videoSrc)
      .then(() => {
        console.log('✅ Video loaded');
        setIsLoading(false);
        
        // Jump to initial time
        if (initialTime > 0) {
          videoRef.current.currentTime = initialTime;
        }
      })
      .catch((err) => {
        console.error('❌ Load failed:', err);
        setError('Video yüklenemedi: ' + err.message);
        setIsLoading(false);
      });
  }, [videoSrc, initialTime]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        toast.error('Oynatma başarısız: ' + err.message);
      });
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl">
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        onClick={togglePlay}
      />

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-sm">
            {currentTime === 0 ? '⚡ İlk yükleme 10-30sn sürebilir...' : 'Yükleniyor...'}
          </p>
          <p className="text-gray-400 text-xs mt-2">
            💡 2. izlemede cache sayesinde anında başlar!
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center text-white p-6">
            <h3 className="text-xl font-bold mb-2">❌ Hata</h3>
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

      {/* Simple Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-10">
        <div className="flex items-center justify-between text-white">
          <button onClick={togglePlay} className="text-2xl hover:text-violet-300">
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <div className="text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Subtitle selector */}
          {subtitles.length > 0 && (
            <select 
              value={selectedSubTrack}
              onChange={(e) => {
                const trackId = parseInt(e.target.value);
                setSelectedSubTrack(trackId);
                playerRef.current?.selectTextTrack(subtitles[trackId]);
                toast.success(`📝 ${subtitles[trackId].language}`);
              }}
              className="bg-black/80 text-white border border-violet-500/50 rounded px-2 py-1 text-sm"
            >
              {subtitles.map((track, idx) => (
                <option key={idx} value={idx}>
                  {track.language} ({track.kind})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-white/20 rounded-full mt-3 cursor-pointer">
          <div 
            className="h-full bg-violet-500 rounded-full"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
