import React, { useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoJS = (props) => {
  const videoRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const prevSourceRef = React.useRef(null);
  const { options, onReady } = props;

  useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");

      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        videojs.log('player is ready');
        
        // AGGRESSIVE subtitle enabling
        const enableSubtitles = () => {
          const tracks = player.textTracks();
          console.log('🎬 Total text tracks:', tracks.length);
          
          // Remove ALL existing tracks first to prevent duplicates
          const existingTracks = player.remoteTextTracks();
          for (let i = existingTracks.length - 1; i >= 0; i--) {
            player.removeRemoteTextTrack(existingTracks[i]);
          }
          console.log(`🧹 Removed ${existingTracks.length} existing tracks`);
          
          if (options.tracks && options.tracks.length > 0) {
            console.log('⚠️ Manually adding tracks...');
            // Manually add tracks
            options.tracks.forEach((trackConfig, index) => {
              console.log(`📝 Adding track ${index}:`, trackConfig);
              const track = player.addRemoteTextTrack({
                ...trackConfig,
                mode: 'showing'
              }, false);
              console.log('Track added:', track);
            });
          }
          
          // Wait for tracks to load, then enable
          setTimeout(() => {
            const tracks = player.textTracks();
            console.log(`🔍 Checking tracks: ${tracks.length} found`);
            
            let subtitleCount = 0;
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              
              if (track.kind === 'subtitles' || track.kind === 'captions') {
                subtitleCount++;
                console.log(`Track ${i}:`, {
                  kind: track.kind,
                  language: track.language,
                  label: track.label,
                  mode: track.mode
                });
                
                // Only enable the FIRST subtitle track
                if (subtitleCount === 1) {
                  track.mode = 'showing';
                  console.log('✅ ENABLED subtitle track:', track.label);
                } else {
                  track.mode = 'disabled';
                  console.log('❌ DISABLED duplicate track:', track.label);
                }
              }
            }
            
            // Final check after 500ms
            setTimeout(() => {
              let enabledCount = 0;
              for (let i = 0; i < tracks.length; i++) {
                if ((tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions')) {
                  if (enabledCount === 0 && tracks[i].mode !== 'showing') {
                    tracks[i].mode = 'showing';
                    enabledCount++;
                    console.log('🔄 Final enable:', tracks[i].label);
                  } else if (enabledCount > 0 && tracks[i].mode === 'showing') {
                    tracks[i].mode = 'disabled';
                    console.log('🗑️ Disabled duplicate:', tracks[i].label);
                  } else if (tracks[i].mode === 'showing') {
                    enabledCount++;
                  }
                }
              }
            }, 500);
          }, 100);
        };
        
        enableSubtitles();
        
        // Also enable on loadeddata
        player.on('loadeddata', () => {
          console.log('📥 Video loaded, checking subtitles...');
          enableSubtitles();
        });
        
        onReady && onReady(player);
      });
      
      prevSourceRef.current = options.sources[0]?.src;
    } else {
      const player = playerRef.current;
      const newSource = options.sources[0]?.src;

      // Only update if source actually changed
      if (newSource && newSource !== prevSourceRef.current) {
        console.log('🔄 Updating player source:', newSource);
        
        const currentTime = player.currentTime();
        player.autoplay(options.autoplay);
        player.src(options.sources);
        
        // Update tracks if provided
        if (options.tracks && options.tracks.length > 0) {
          console.log('🔄 Updating tracks for new source...');
          
          // Remove old tracks
          const oldTracks = player.remoteTextTracks();
          console.log(`🗑️ Removing ${oldTracks.length} old tracks`);
          for (let i = oldTracks.length - 1; i >= 0; i--) {
            player.removeRemoteTextTrack(oldTracks[i]);
          }
          
          // Add new tracks
          options.tracks.forEach((track, index) => {
            console.log(`➕ Adding track ${index}:`, track);
            player.addRemoteTextTrack({
              ...track,
              mode: 'showing' // Force mode
            }, false);
          });
          
          // Enable subtitles aggressively
          const forceEnable = () => {
            const tracks = player.textTracks();
            console.log(`🔍 Force enabling ${tracks.length} tracks`);
            for (let i = 0; i < tracks.length; i++) {
              if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
                tracks[i].mode = 'showing';
                console.log('✅ Re-enabled subtitle track:', tracks[i].label);
              }
            }
          };
          
          setTimeout(forceEnable, 100);
          setTimeout(forceEnable, 500);
          setTimeout(forceEnable, 1000);
        }
        
        player.load();
        
        // If it's the same video (just different quality), restore time
        // Otherwise start from beginning
        if (prevSourceRef.current && newSource.includes(prevSourceRef.current.split('/').pop())) {
          player.currentTime(currentTime);
        }
        
        prevSourceRef.current = newSource;
      }
    }
  }, [options, videoRef]);

  // Dispose the Video.js player when the functional component unmounts, otherwise memory leak ho jayega lmao
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  );
};

export default VideoJS;