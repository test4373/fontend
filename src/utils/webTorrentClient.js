// Frontend WebTorrent Client - P2P Streaming
import WebTorrent from 'webtorrent';

// Singleton WebTorrent client
let client = null;

export const getWebTorrentClient = () => {
  if (!client) {
    client = new WebTorrent({
      // WebRTC için tracker'lar
      tracker: {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      },
      // Download etme, sadece stream et
      downloadLimit: -1, // Unlimited download
      uploadLimit: 512 * 1024 // 512 KB/s upload (share etmek için)
    });
    
    console.log('🌐 WebTorrent client initialized (P2P mode)');
  }
  
  return client;
};

// Torrent'i ekle ve stream URL döndür
export const addTorrentForStreaming = async (magnetURI, filename) => {
  const client = getWebTorrentClient();
  
  return new Promise((resolve, reject) => {
    // Check if already added
    const existingTorrent = client.get(magnetURI);
    if (existingTorrent) {
      console.log('✅ Torrent already added');
      const file = existingTorrent.files.find(f => f.name === filename);
      if (file) {
        // Create blob URL for streaming
        const url = file.streamURL || URL.createObjectURL(file);
        resolve({ url, torrent: existingTorrent, file });
        return;
      }
    }
    
    console.log('📥 Adding torrent for P2P streaming...');
    console.log('  Magnet:', magnetURI.substring(0, 60) + '...');
    
    client.add(magnetURI, (torrent) => {
      console.log('✅ Torrent added:', torrent.name);
      console.log('  Files:', torrent.files.length);
      console.log('  Peers:', torrent.numPeers);
      
      const file = torrent.files.find(f => f.name === filename);
      
      if (!file) {
        reject(new Error('File not found in torrent'));
        return;
      }
      
      console.log('📺 Streaming file:', file.name);
      console.log('  Size:', (file.length / 1024 / 1024).toFixed(2), 'MB');
      
      // Select file for download
      file.select();
      
      // Deselect others to save bandwidth
      torrent.files.forEach(f => {
        if (f !== file) f.deselect();
      });
      
      // Monitor progress
      torrent.on('download', () => {
        console.log('📊 Progress:', (torrent.progress * 100).toFixed(1) + '%', 
                    '| Download:', (torrent.downloadSpeed / 1024).toFixed(0), 'KB/s',
                    '| Peers:', torrent.numPeers);
      });
      
      // Create stream URL
      file.getBlobURL((err, url) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('✅ P2P Stream URL created:', url.substring(0, 50) + '...');
        resolve({ url, torrent, file });
      });
    });
    
    client.on('error', (err) => {
      console.error('❌ WebTorrent error:', err);
      reject(err);
    });
  });
};

// Torrent'i kaldır
export const removeTorrent = (magnetURI) => {
  const client = getWebTorrentClient();
  const torrent = client.get(magnetURI);
  
  if (torrent) {
    console.log('🗑️ Removing torrent:', torrent.name);
    torrent.destroy();
  }
};

// Tüm torrent'leri listele
export const getAllTorrents = () => {
  const client = getWebTorrentClient();
  return client.torrents.map(t => ({
    name: t.name,
    magnetURI: t.magnetURI,
    progress: t.progress,
    downloadSpeed: t.downloadSpeed,
    uploadSpeed: t.uploadSpeed,
    numPeers: t.numPeers
  }));
};
