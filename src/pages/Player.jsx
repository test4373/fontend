import axios from "axios";
import { useRef, useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Button } from "@radix-ui/themes";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { watchAPI } from '../utils/api';
import SimplePlayer from "../components/SimplePlayer";
import EpisodesPlayer from "../components/EpisodesPlayer";
import CommentSection from "../components/CommentSection";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://zens23.onrender.com';

export default function Player() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const params = useParams();
  const magnetURI = params.magnetId;
  const currentEpisodeFromUrl = parseInt(params.currentEpisodeNum) || 1;
  const location = useLocation();
  const animeData = location.state?.data;
  const [animeId, setAnimeId] = useState(animeData?.id?.toString() || null);

  const [videoSrc, setVideoSrc] = useState("");
  const [subtitleSrc, setSubtitleSrc] = useState("");
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState("");
  const [currentEpisodeNum, setCurrentEpisodeNum] = useState(currentEpisodeFromUrl);
  const [autoPlayStarted, setAutoPlayStarted] = useState(false);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const [watchStartTime, setWatchStartTime] = useState(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [savedProgress, setSavedProgress] = useState(0);
  const [quality, setQuality] = useState('1080p');
  const [upscaleAvailable, setUpscaleAvailable] = useState(false);
  const [upscaleFiles, setUpscaleFiles] = useState([]);
  const [originalVideoSrc, setOriginalVideoSrc] = useState("");
  // Removed DASH/HLS: always use direct progressive streaming
  const savedProgressRef = useRef(0);
  const progressUpdateIntervalRef = useRef(null);
  const [playerKey, setPlayerKey] = useState(Date.now()); // Key to force player remount on episode change
  const [idmWarningShown, setIdmWarningShown] = useState(false);

  useEffect(() => {
    const warned = sessionStorage.getItem('idm_warning_shown');
    
    if (!warned && !idmWarningShown) {
      setIdmWarningShown(true);
      sessionStorage.setItem('idm_warning_shown', 'true');
      setTimeout(() => {
        toast.warning('⚠️ IDM/Download Manager', {
          description: 'Video için IDM kapatın',
          duration: 5000
        });
      }, 2000);
    }
  }, [idmWarningShown]);

  useEffect(() => {
    if (!animeId && magnetURI) {
      const decodedMagnet = decodeURIComponent(magnetURI);
      const hash = decodedMagnet.split('&')[0].replace('magnet:?xt=urn:btih:', '');
      const extractedId = hash.substring(0, 10);
      if (extractedId && extractedId !== 'null') {
        setAnimeId(extractedId);
      }
    }
  }, [magnetURI, animeId]);

  useEffect(() => {
    const fetchSavedProgress = async () => {
      if (isAuthenticated && animeData?.id && magnetURI && currentEpisodeNum) {
        try {
          const response = await watchAPI.getHistory();
          const history = response.data.data || [];
          const savedAnime = history.find(
            item => item.anime_id === animeData.id.toString() && 
                   item.magnet_uri === magnetURI &&
                   item.episode_number === currentEpisodeNum
          );
          if (savedAnime && savedAnime.current_time > 0) {
            const timeToUse = savedAnime.current_time;
            setSavedProgress(timeToUse);
            savedProgressRef.current = timeToUse;
          }
        } catch (error) {
          console.error('Error fetching saved progress:', error);
        }
      }
    };
    fetchSavedProgress();
  }, [isAuthenticated, animeData?.id, magnetURI, currentEpisodeNum]);

  useEffect(() => {
    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
    };
  }, [isAuthenticated, animeData, currentEpisodeNum, animeId, magnetURI]);

  const getFiles = async () => {
    if (files && files.length > 0) return Promise.resolve();
    setLoadingFiles(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/metadata/${encodeURIComponent(magnetURI)}`
      );
      const data = await response.data;
      setFiles(data);
      return Promise.resolve();
    } catch (error) {
      // Don't show error for backend not running - use HLS mode instead
      console.warn('Backend not running, using HLS mode');
      return Promise.reject(error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleVideoTimeUpdate = async (currentTime, duration) => {
    if (!isAuthenticated || !animeData) return;
    const progress = (currentTime / duration) * 100;
    if (Math.abs(currentTime - lastProgressUpdate) >= 1) {
      setLastProgressUpdate(currentTime);
      await updateWatchHistory(progress, currentTime, false);
    }
  };

  const handleQualityChange = (newQuality) => {
    setQuality(newQuality);
    if (currentEpisode) {
      let newVideoUrl;
      if (newQuality === '4K' && upscaleAvailable && upscaleFiles.length > 0) {
        const anime = 'DandadanS02E01';
        const ep = 'DandadanS02E01';
        const filename = upscaleFiles[0].name;
        newVideoUrl = `${BACKEND_URL}/stream-upscale/${encodeURIComponent(anime)}/${encodeURIComponent(ep)}/${encodeURIComponent(filename)}`;
        toast.success('🌟 4K Upscale Aktif!');
      } else {
        newVideoUrl = originalVideoSrc;
        toast.info('📺 1080p HD');
      }
      setVideoSrc(newVideoUrl);
    }
  };

  const updateWatchHistory = async (progress, currentTimeSeconds, forceUpdate = false) => {
    if (!isAuthenticated || !animeData) return;
    if (!forceUpdate && Math.abs(currentTimeSeconds - lastProgressUpdate) < 0.5) return;

    try {
      const now = Date.now();
      let watchTimeDelta = 10;
      if (watchStartTime) {
        watchTimeDelta = Math.floor((now - watchStartTime) / 1000);
      }
      setWatchStartTime(now);
      setTotalWatchTime(prev => prev + watchTimeDelta);
      setLastProgressUpdate(currentTimeSeconds);

      const historyData = {
        animeId: animeData.id?.toString() || animeId,
        animeTitle: animeData.title?.romaji || animeData.title?.english || 'Unknown Anime',
        animeImage: animeData.coverImage?.extraLarge || animeData.coverImage?.large || '',
        episodeNumber: currentEpisodeNum,
        progress: Math.round(progress),
        currentTime: currentTimeSeconds,
        magnetUri: magnetURI,
        watchTime: watchTimeDelta
      };

      await watchAPI.addToHistory(historyData);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  useEffect(() => {
    const checkUpscale = async () => {
      try {
        const anime = 'DandadanS02E01';
        const episode = 'DandadanS02E01';
        const response = await axios.get(
          `${BACKEND_URL}/upscale-available/${encodeURIComponent(anime)}/${encodeURIComponent(episode)}`
        );
        if (response.data.available && response.data.files.length > 0) {
          setUpscaleAvailable(true);
          setUpscaleFiles(response.data.files);
        }
      } catch (error) {
        console.error('Error checking upscale:', error);
      }
    };
    checkUpscale();
  }, [currentEpisodeNum]);

  const handleStreamBrowser = async (episode, selectedQuality = null) => {
    const useQuality = selectedQuality || quality;
    const episodeMatch = episode.match(/(\d+)/);
    const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : 1;
    if (episodeNumber === currentEpisodeNum && videoSrc) return;

    try {
      await axios.get(`${BACKEND_URL}/add/${encodeURIComponent(magnetURI)}`);
    } catch (error) {
      // Don't show error for backend not running - use HLS mode instead
      console.warn('Backend not running for torrent add, using HLS mode');
    }
    
    setCurrentEpisodeNum(episodeNumber);
    setLastProgressUpdate(0);
    setPlayerKey(Date.now()); // Force player remount on episode change to reset state

    // 🔥 STEP 1: Fetch audio/subtitle tracks FIRST (for menus)
    let shouldUseDirect = true; // Always direct streaming; still fetch tracks for UI
    let audioList = [];
    let subtitleList = [];
    
    // 🔄 Retry logic for track fetching (wait for buffering)
    let tracksResponse = null;
    let retryCount = 0;
    const MAX_RETRIES = 6; // 6 retries = 60 seconds total
    
    while (!tracksResponse && retryCount < MAX_RETRIES) {
      try {
        tracksResponse = await axios.get(`${BACKEND_URL}/tracks/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`);
        
        // Check if we got actual data or just "buffering" response
        if (tracksResponse.data.ready === false) {
          console.log('⏳ Buffering...', tracksResponse.data.progress || 'Unknown', '- Retry', retryCount + 1, '/', MAX_RETRIES);
          toast.info(`📊 Buffering... ${tracksResponse.data.progress || '?'}`, { duration: 2000 });
          tracksResponse = null; // Reset to retry
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          continue;
        }
        
        // Success - break out of retry loop
        break;
      } catch (error) {
        console.error(`❌ Track fetch attempt ${retryCount + 1} failed:`, error.message);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          toast.warning(`⏳ Trying again... (${retryCount}/${MAX_RETRIES})`, { duration: 2000 });
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
      }
    }
    
    if (!tracksResponse) {
      console.error('❌ Failed to fetch tracks after', MAX_RETRIES, 'retries');
      throw new Error('Track fetch timeout');
    }
    
    try {
      const { subtitles, audio } = tracksResponse.data;

      console.log('📝 Available subtitles from MKV:', subtitles);
      console.log('🔊 Available audio tracks from MKV:', audio);

      // Parse audio tracks
      if (audio && audio.length > 0) {
        audioList = audio.map((track, index) => ({
          label: track.title || `${track.language || 'Unknown'} Audio ${index + 1}`,
          lang: track.language || 'unknown',
          index: track.index,
          codec: track.codec || 'unknown'
        }));
        console.log('✅ Audio tracks detected:', audioList);

        // Check for unsupported codecs with MediaSource API
        const checkCodecSupport = (codec) => {
          if (!codec) return { supported: false, reason: 'Unknown codec' };

          const codecLower = codec.toLowerCase();

          // Browser-friendly codecs (definitely supported)
          if (['aac', 'mp3', 'opus', 'vorbis', 'mp4a'].some(c => codecLower.includes(c))) {
            return { supported: true, reason: 'Browser native support' };
          }

          // Codecs that might work in some browsers/containers
          if (['eac3', 'ec-3'].some(c => codecLower.includes(c))) {
            // EAC3 can work in MP4 containers with some browsers
            if (window.MediaSource) {
              const mimeType = `audio/mp4; codecs="ec-3"`;
              if (MediaSource.isTypeSupported(mimeType)) {
                return { supported: true, reason: 'EAC3/EC-3 supported via MediaSource' };
              }
            }
            return { supported: false, reason: 'EAC3/EC-3 may not be supported' };
          }

          // Known problematic codecs
          if (['ac3', 'ac-3', 'dts', 'truehd', 'flac'].some(c => codecLower.includes(c))) {
            return { supported: false, reason: 'Not supported by browsers' };
          }

          // Try MediaSource API check for other codecs
          if (window.MediaSource) {
            const mimeTypes = [
              `audio/mp4; codecs="${codec}"`,
              `audio/webm; codecs="${codec}"`,
            ];

            for (const mimeType of mimeTypes) {
              if (MediaSource.isTypeSupported(mimeType)) {
                return { supported: true, reason: 'MediaSource API confirmed' };
              }
            }
          }

          return { supported: false, reason: 'Codec verification failed' };
        };

        const codecChecks = audioList.map(track => ({
          ...track,
          support: checkCodecSupport(track.codec)
        }));

        const unsupportedTracks = codecChecks.filter(t => !t.support.supported);
        const supportedTracks = codecChecks.filter(t => t.support.supported);

        console.log('✅ Supported audio tracks:', supportedTracks);
        console.log('❌ Unsupported audio tracks:', unsupportedTracks);

        // We do NOT auto-transcode; warn user if codecs likely unsupported
        if (unsupportedTracks.length > 0) {
          console.warn('⚠️ Potentially unsupported audio codecs detected:', unsupportedTracks.map(t => t.codec).join(', '));
          // Only show warning for definitely unsupported codecs, not EAC3
          const definitelyUnsupported = unsupportedTracks.filter(t => 
            !['eac3', 'ec-3'].some(c => t.codec.toLowerCase().includes(c))
          );
          if (definitelyUnsupported.length > 0) {
            toast.warning('⚠️ Tarayıcı bu ses kodeğini desteklemeyebilir', { duration: 3500 });
          }
        }
      } else {
        console.warn('❌ No audio tracks found in MKV metadata');
        // Don't show error yet - might be a metadata parsing issue
      }

      // 📝 Build comprehensive subtitle list from MKV metadata
      if (subtitles && subtitles.length > 0) {
        subtitleList = subtitles.map((sub, index) => {
          const languageName = {
            'eng': 'English',
            'tur': 'Türkçe',
            'jpn': '日本語',
            'ara': 'العربية',
            'spa': 'Español',
            'fre': 'Français',
            'ger': 'Deutsch',
            'ita': 'Italiano',
            'por': 'Português',
            'rus': 'Русский',
            'chi': '中文',
            'kor': '한국어'
          }[sub.language] || sub.language || 'Unknown';

          // Normalize label to always include language to avoid duplicates like many "AMZN"
          const provider = (sub.title && !String(sub.title).toLowerCase().includes(String(languageName).toLowerCase())) ? ` - ${sub.title}` : '';
          const codecSuffix = sub.codec ? ` (${sub.codec.toUpperCase()})` : '';
          const normalizedLabel = `${languageName}${provider}${codecSuffix}`.trim();

          return {
            src: `${BACKEND_URL}/subtitle/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}/${index}`,
            lang: sub.language || 'unknown',
            label: normalizedLabel,
            index: index,
            codec: sub.codec,
            default: sub.default || index === 0, // First subtitle is default
            forced: sub.forced || false
          };
        });

        // Deduplicate: keep only first subtitle per language code
        const seenLang = new Set();
        const deduped = [];
        for (const s of subtitleList) {
          const key = (s.lang || 'unknown').toLowerCase();
          if (!seenLang.has(key)) {
            seenLang.add(key);
            deduped.push(s);
          }
        }

        console.log('✅ Processed', subtitleList.length, 'subtitle tracks');
        console.log('🧹 Deduplicated to', deduped.length, 'by language');
        console.log('📝 Subtitle URLs:');
        deduped.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}: ${s.src}`));
        setAvailableSubtitles(deduped);

        // Set first subtitle as active
        if (deduped.length > 0) {
          setSubtitleSrc(deduped[0].src);
          console.log('🎯 Active subtitle:', deduped[0].label);
        }
      } else {
        // Fallback: Try generic subtitle endpoint
        console.warn('⚠️ No subtitles found in MKV metadata, trying fallback endpoint');
        const subtitleUrl = `${BACKEND_URL}/subtitles/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`;
        subtitleList = [{
          src: subtitleUrl,
          lang: 'en',
          label: 'English (Fallback)',
          default: true
        }];
        setSubtitleSrc(subtitleUrl);
        setAvailableSubtitles(subtitleList);
      }
    } catch (error) {
      console.error('❌ Error fetching tracks:', error);
      // If track fetch fails, continue with direct stream anyway
      shouldUseDirect = true;
      // Fallback to default subtitle endpoint
      const subtitleUrl = `${BACKEND_URL}/subtitles/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`;
      subtitleList = [{
        src: subtitleUrl,
        lang: 'en',
        label: 'English (Fallback)',
        default: true
      }];
      setSubtitleSrc(subtitleUrl);
      setAvailableSubtitles(subtitleList);
      toast.warning('⚠️ Track bilgisi alınamadı, yedek kullanılıyor', { duration: 3000 });
    }

    // 🎬 STEP 2: Set video source (with smart codec handling)
    setAvailableAudioTracks(audioList);
    
    const cfParams = new URLSearchParams();
    cfParams.set('nocache', Date.now().toString());
    const bypassParam = `?${cfParams.toString()}`;
    
    // Check if we need transcoding for audio compatibility
    // Only transcode for truly unsupported codecs (NOT eac3, let browser try first)
    const needsTranscoding = audioList.some(track => {
      const codec = track.codec?.toLowerCase() || '';
      // Only transcode for definitely unsupported codecs
      return ['ac3', 'ac-3', 'dts', 'truehd', 'flac'].some(unsupported => 
        codec.includes(unsupported)
      );
    });
    
    // Build video URL with smart codec handling
    let videoUrl;
    if (useQuality === '4K' && upscaleAvailable && upscaleFiles.length > 0) {
      const anime = 'DandadanS02E01';
      const ep = 'DandadanS02E01';
      const filename = upscaleFiles[0].name;
      videoUrl = `${BACKEND_URL}/stream-upscale/${encodeURIComponent(anime)}/${encodeURIComponent(ep)}/${encodeURIComponent(filename)}${bypassParam}`;
      console.log('⚡ 4K Upscale streaming URL:', videoUrl);
      toast.info('⚡ 4K Upscale Aktif', { duration: 2000 });
    } else if (needsTranscoding) {
      // Use transcoding endpoint for unsupported audio codecs
      videoUrl = `${BACKEND_URL}/streamfile-transcode/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}${bypassParam}`;
      console.log('🔄 Audio transcoding URL (EAC3/AC3 → AAC):', videoUrl);
      toast.info('🔄 Ses kodeği dönüştürülüyor (EAC3 → AAC)', { duration: 3000 });
    } else {
      // Use direct streaming for compatible codecs
      videoUrl = `${BACKEND_URL}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}${bypassParam}`;
      console.log('🎬 Direct streaming URL:', videoUrl);
    }
    
    setOriginalVideoSrc(videoUrl);
    setVideoSrc(videoUrl);

    if (isAuthenticated && animeData) {
      try {
        setWatchStartTime(Date.now());
        setTotalWatchTime(0);
        setLastProgressUpdate(0);

        let savedTime = 0;
        const response = await watchAPI.getHistory();
        const history = response.data.data || [];
        const savedAnime = history.find(
          item => item.anime_id === animeData.id.toString() && 
                 item.magnet_uri === magnetURI &&
                 item.episode_number === episodeNumber
        );
        if (savedAnime && savedAnime.current_time > 0) {
          savedTime = savedAnime.current_time;
        }
        setSavedProgress(savedTime);
        savedProgressRef.current = savedTime;
        console.log('📍 Progress for episode', episodeNumber, ':', savedTime, 's');
      } catch (error) {
        console.error('Tracking failed:', error);
      }
    }
  };

  const handleStreamVlc = async (episode) => {
    try {
      await axios.get(
        `${BACKEND_URL}/stream-to-vlc?url=${encodeURIComponent(
          `${BACKEND_URL}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`
        )}`
      );
      toast.success(t('player.vlcLaunched'));
    } catch (error) {
      toast.error(t("errorStreamingToVLC") || "VLC error");
    }
  };

  const handleStreamMpv = async (episode) => {
    try {
      const videoUrl = `${BACKEND_URL}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`;
      await axios.get(`${BACKEND_URL}/stream-to-mpv?url=${encodeURIComponent(videoUrl)}`);
      toast.success(t('player.mpvLaunched'));
    } catch (error) {
      toast.error(t('player.mpvFailed'));
    }
  };

  const handleRemoveTorrent = async () => {
    setVideoSrc("");
    setSubtitleSrc("");
    setCurrentEpisode("");
    setOriginalVideoSrc("");

    try {
      await axios.delete(`${BACKEND_URL}/remove/${encodeURIComponent(magnetURI)}`);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Error removing torrent", error);
      }
    }
    toast.success(t("player.videoStopped") || "Video stopped");
  };

  // Auto-load files and start playing first episode
  useEffect(() => {
    const autoLoad = async () => {
      if (magnetURI && (!files || files.length === 0) && !autoPlayStarted) {
        try {
          await getFiles();
          setAutoPlayStarted(true);
        } catch (error) {
          console.error('Auto-load failed:', error);
        }
      }
    };
    autoLoad();
  }, [magnetURI, autoPlayStarted]);

  // Auto-play first episode when files are loaded
  useEffect(() => {
    if (files && files.length > 0 && !currentEpisode && !videoSrc) {
      const firstFile = files[0];
      console.log('🎬 Auto-playing first episode:', firstFile.name);
      setCurrentEpisode(firstFile.name);
      handleStreamBrowser(firstFile.name);
      toast.success('🎬 Oynatılıyor: ' + firstFile.name, { duration: 3000 });
    }
  }, [files, currentEpisode, videoSrc]);

  // Cleanup: Remove torrent when navigating away
  useEffect(() => {
    return () => {
      if (magnetURI && videoSrc) {
        console.log('🧹 Cleaning up: removing torrent on unmount');
        axios.delete(`${BACKEND_URL}/remove/${encodeURIComponent(magnetURI)}`)
          .then(() => console.log('✅ Torrent removed'))
          .catch(err => console.error('❌ Cleanup failed:', err));
      }
    };
  }, [magnetURI, videoSrc]);

  useEffect(() => {
    if (videoSrc && currentEpisode) {
      handleStreamBrowser(currentEpisode, quality);
    }
  }, [quality]);

  const playerWrapperRef = useRef(null);

  const mkvFiles = (files || []).filter(f => String(f?.name || '').toLowerCase().endsWith('.mkv'));

  return (
    <div className="flex flex-col items-center justify-center font-space-mono">
      <div className="w-full max-w-7xl mb-6 px-4" ref={playerWrapperRef}>
        <SimplePlayer
          key={playerKey}
          videoSrc={videoSrc}
          onTimeUpdate={handleVideoTimeUpdate}
          initialTime={savedProgress}
          availableSubtitles={availableSubtitles}
          availableAudioTracks={availableAudioTracks}
        />
      </div>
      

      <div className="w-full max-w-6xl px-4">
        {/* Loading list UI removed per request - player shows its own overlay */}

        {/* Info badge removed as requested */}

        {!loadingFiles && files && files.length > 0 && (
          mkvFiles.length > 1 ? (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8"></div>
              <div className="md:col-span-4">
                <h2 className="text-xl font-bold mb-4 px-2">{t('player.episodes') || 'Bölümler'}</h2>
                {mkvFiles.map((file, index) => (
                  <EpisodesPlayer
                    key={file.name || index}
                    file={file}
                    handleStreamBrowser={handleStreamBrowser}
                    handleStreamVlc={handleStreamVlc}
                    handleStreamMpv={handleStreamMpv}
                    setCurrentEpisode={setCurrentEpisode}
                    getFiles={getFiles}
                    handleRemoveTorrent={handleRemoveTorrent}
                    videoSrc={videoSrc}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}

        {!loadingFiles && (!files || files.length === 0) && (
          <div className="text-center py-12 border border-gray-700 rounded-lg bg-[#1d1d20]">
            <p className="text-gray-400 mb-4">⚠️ {t('player.noFilesFound') || 'Dosya yok'}</p>
            <Button onClick={getFiles} size="3" color="blue" variant="solid">
              {t('player.tryAgain') || 'Tekrar Dene'}
            </Button>
          </div>
        )}

        {isAuthenticated && animeId && (
          <div className="mt-8 border border-gray-700 bg-[#1d1d20] p-6 rounded-lg">
            <CommentSection animeId={animeId} />
          </div>
        )}
      </div>
    </div>
  );
}
