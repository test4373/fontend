import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '@radix-ui/themes';
import { TrashIcon, VideoIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';

// Backend URL - Render.com deployment
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://zens23.onrender.com';

export default function Downloads() {
  const { t } = useTranslation();
  const [activeTorrents, setActiveTorrents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveTorrents();
    const interval = setInterval(fetchActiveTorrents, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchActiveTorrents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/active-torrents`);
      setActiveTorrents(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching active torrents:', error);
      setLoading(false);
    }
  };

  const handleRemoveTorrent = async (magnetURI) => {
    try {
      await axios.delete(`${BACKEND_URL}/remove/${encodeURIComponent(magnetURI)}`);
      toast.success(t('torrentRemovedSuccessfully') || 'Torrent removed');
      fetchActiveTorrents();
    } catch (error) {
      console.error('Error removing torrent:', error);
      toast.error(t('errorRemovingTorrent') || 'Error removing torrent');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec) => {
    return formatBytes(bytesPerSec) + '/s';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 font-space-mono">{t('header.downloads')}</h1>
      
      {activeTorrents.length === 0 ? (
        <div className="text-center py-12 border border-gray-700 rounded-lg bg-[#1d1d20]">
          <VideoIcon className="mx-auto mb-4 h-12 w-12 text-gray-500" />
          <p className="text-gray-400 mb-2">{t('downloads.noActiveTorrents') || 'No active downloads'}</p>
          <p className="text-gray-500 text-sm">{t('downloads.startWatching') || 'Start watching an anime to see downloads here'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTorrents.map((torrent, index) => (
            <div 
              key={index}
              className="border border-gray-700 bg-[#1d1d20] rounded-lg p-4 hover:bg-[#2a2a2e] transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 line-clamp-1">{torrent.name}</h3>
                  <p className="text-sm text-gray-400">
                    {formatBytes(torrent.downloaded)} / {formatBytes(torrent.length)}
                  </p>
                </div>
                <Button
                  color="red"
                  variant="soft"
                  size="1"
                  onClick={() => handleRemoveTorrent(torrent.magnetURI)}
                >
                  <TrashIcon />
                  {t('stopAndRemoveAnime') || 'Remove'}
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${((torrent.progress || 0) * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{((torrent.progress || 0) * 100).toFixed(1)}%</span>
                  <span>{formatSpeed(torrent.downloadSpeed || 0)} ↓ / {formatSpeed(torrent.uploadSpeed || 0)} ↑</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm text-gray-400">
                <span>👥 {torrent.numPeers || 0} peers</span>
                <span>📊 Ratio: {(torrent.ratio || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
