import { useRef, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export default function VideoJsPlayer({ 
  videoSrc,
  onTimeUpdate,
  initialTime = 0,
  animeId = null,
  episodeNumber = null,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // 🔥 Viewport visibility için

  // Video format detection based on URL extension
  const getVideoType = (src) => {
    if (!src) return 'video/mp4';
    const extension = src.split('.').pop().toLowerCase();
    switch (extension) {
      case 'mkv':
        return 'video/x-matroska';
      case 'mp4':
        return 'video/mp4';
      case 'm3u8': // HLS desteği için
        return 'application/x-mpegURL';
      case 'webm':
        return 'video/webm';
      default:
        return 'video/mp4';
    }
  };

  // 🔥 Viewport observer - Ultra hız: Sadece görünürken yükle
  useEffect(() => {
    if (!videoRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize Video.js - Ultra optimizasyonlar
  useEffect(() => {
    if (!window.videojs || !isVisible) return; // 🔥 Görünmezse init etme

    if (!videoRef.current) return;

    const player = window.videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      preload: 'none', // 🔥 Ultra hız: Hiçbir şey ön yükleme, play'de başla
      autoplay: false,
      html5: {
        vhs: {
          withCredentials: false,
          overrideNative: true, // HLS native zorla
          enableLowInitialPlaylist: true, // Düşük kaliteyle başla
          smoothQualityChange: true, // Pürüzsüz kalite değişimi
          useDevicePixelRatio: true, // Cihaz optimizasyonu
        },
        nativeTextTracks: true,
        nativeAudioTracks: true,
        nativeVideoTracks: true,
      },
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'remainingTimeDisplay',
          'playbackRateMenuButton',
          'chaptersButton',
          'descriptionsButton',
          'subsCapsButton', // 🔥 Multi sub
          'audioTrackButton', // 🔥 Multi dub
          'fullscreenToggle',
        ],
      },
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    });

    playerRef.current = player;
    setIsReady(true);

    console.log('✅ Video.js ultra-optimized player initialized');

    // 🔥 Play'de preload ve buffer'ı tetikle
    player.on('play', () => {
      if (player.preload() !== 'auto') {
        player.preload('auto');
        console.log('🚀 Ultra buffer başlatıldı');
      }
    });

    // 🔥 Multi sub/dub event'leri - Track değişimini toast'la
    player.on('change', () => {
      const audioTracks = player.audioTracks();
      const textTracks = player.textTracks();
      if (audioTracks && audioTracks.length > 1) {
        const selectedAudio = Array.from(audioTracks).find(t => t.enabled);
        toast.info('🎵 Dub Değiştirildi', {
          description: selectedAudio?.label || 'Varsayılan',
          duration: 2000
        });
      }
      if (textTracks && textTracks.length > 1) {
        const selectedSub = Array.from(textTracks).find(t => t.mode === 'showing');
        toast.info('📝 Sub Değiştirildi', {
          description: selectedSub?.label || 'Kapalı',
          duration: 2000
        });
      }
    });

    // Diğer event'ler (kısaltılmış)
    player.on('loadedmetadata', () => {
      console.log('📺 Metadata loaded (ultra fast)');
      if (initialTime > 0) player.currentTime(initialTime);

      // 🔥 Multi sub/dub listele ve varsayılanı ayarla
      const audioTracks = player.audioTracks();
      if (audioTracks && audioTracks.length > 1) {
        console.log('🎵 Available dubs:');
        for (let i = 0; i < audioTracks.length; i++) {
          const track = audioTracks[i];
          console.log(`  ${i + 1}. ${track.label || 'Dub ' + (i + 1)} (${track.language || 'unknown'})`);
          if (i === 0) track.enabled = true; // Varsayılan dub
        }
        toast.success(`🎵 ${audioTracks.length} dub track!`, {
          description: 'Ses menüsünden değiştirin',
          duration: 3000
        });
      }

      const textTracks = player.textTracks();
      if (textTracks && textTracks.length > 1) {
        console.log('📝 Available subs:');
        for (let i = 0; i < textTracks.length; i++) {
          const track = textTracks[i];
          console.log(`  ${i + 1}. ${track.label || 'Sub ' + (i + 1)} (${track.language || 'unknown'})`);
          if (i === 0) track.mode = 'showing'; // Varsayılan sub
        }
        toast.success(`📝 ${textTracks.length} sub track!`, {
          description: 'Altyazı menüsünden değiştirin',
          duration: 3000
        });
      }
    });

    player.on('timeupdate', () => {
      if (onTimeUpdate) {
        onTimeUpdate(player.currentTime(), player.duration());
      }
    });

    player.on('error', (error) => {
      console.error('❌ Error:', error);
      const videoType = getVideoType(videoSrc);
      if (videoType === 'video/x-matroska') {
        toast.error('MKV Hatası', { description: 'MP4/HLS\'e geçin.' });
      } else {
        toast.error('Video Hatası');
      }
    });

    player.on('waiting', () => console.log('⏳ Buffering...'));
    player.on('playing', () => console.log('▶️ Playing (ultra smooth)'));

    // Cleanup
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [isVisible]); // 🔥 Dependency: Sadece visible olunca init

  // Update video source - Memoized callback ile optimize
  const updateSource = useCallback(() => {
    if (!isReady || !playerRef.current || !videoSrc) return;

    console.log('🔄 Ultra fast source update:', videoSrc);
    
    const videoType = getVideoType(videoSrc);
    if (videoType === 'video/x-matroska') {
      toast.warning('MKV', { description: 'MP4/HLS önerilir.' });
    } else if (videoType === 'application/x-mpegURL') {
      toast.success('HLS', { description: 'Ultra hızlı adaptive streaming!' });
    }

    playerRef.current.src({ src: videoSrc, type: videoType });
    playerRef.current.load();
    playerRef.current.preload('metadata'); // Hızlı metadata
  }, [videoSrc, isReady]);

  useEffect(() => {
    updateSource();
  }, [updateSource]);

  // 🔥 Eğer visible değilse loading gizle
  if (!isVisible) {
    return <div className="w-full h-64 bg-black/20 flex items-center justify-center">Video viewport\'ta yüklenecek...</div>;
  }

  return (
    <div className="w-full relative" data-vjs-player>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-theme-fantasy"
        crossOrigin="anonymous"
        preload="none" // 🔥 Ultra hız: Hiç yükleme
        playsInline // Mobil optimizasyon
      />
      
      {/* Loading - Süper kısa */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-white text-xs">⚡ Anında yükleniyor...</p>
        </div>
      )}
    </div>
  );
}