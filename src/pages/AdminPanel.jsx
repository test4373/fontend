import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../utils/api';
import { toast } from 'sonner';
import { TrashIcon, MagnifyingGlassIcon, PlusIcon, DownloadIcon } from '@radix-ui/react-icons';

// Backend URL from environment variable
const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://zens23.onrender.com/api';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [torrentResults, setTorrentResults] = useState([]);
  const [mkvResults, setMkvResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadMode, setUploadMode] = useState('url'); // 'url' or 'file'
  const [selectedFile, setSelectedFile] = useState(null);
  const queryClient = useQueryClient();

    // Stats Query
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      console.log('📊 Fetching stats...');
      const result = await adminAPI.getStats();
      console.log('📊 Stats result:', result);
      return result;
    },
    retry: 1,
  });

    // Admins Query
  const { data: admins, isLoading: adminsLoading, error: adminsError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      console.log('👥 Fetching admins...');
      const result = await adminAPI.getAdmins();
      console.log('👥 Admins result:', result);
      return result;
    },
    retry: 1,
  });

  // 4K Episodes Query
  const { data: episodes4k, isLoading: episodes4kLoading } = useQuery({
    queryKey: ['admin-4k-episodes'],
    queryFn: adminAPI.getAll4KEpisodes,
  });

  // Grant Admin Mutation
  const grantAdminMutation = useMutation({
    mutationFn: adminAPI.grantAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('Admin yetkisi verildi!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Hata oluştu');
    },
  });

  // Revoke Admin Mutation
  const revokeAdminMutation = useMutation({
    mutationFn: adminAPI.revokeAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('Admin yetkisi kaldırıldı!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Hata oluştu');
    },
  });

  // Delete 4K Episode Mutation
  const delete4KEpisodeMutation = useMutation({
    mutationFn: adminAPI.delete4KEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-4k-episodes']);
      toast.success('4K bölüm silindi!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Hata oluştu');
    },
  });

  // Add 4K Episode Mutation
  const add4KEpisodeMutation = useMutation({
    mutationFn: adminAPI.add4KEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-4k-episodes']);
      toast.success('4K bölüm başarıyla eklendi!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Hata oluştu');
    },
  });

    // Anime Search Mutation
  const animeSearchMutation = useMutation({
    mutationFn: (query) => adminAPI.searchAnime(query),
    onSuccess: (response) => {
      toast.success('Anime bulundu!');
    },
    onError: (error) => {
      toast.error('Anime arama hatası: ' + error.message);
    },
  });

  // Torrent Search Mutation
  const torrentSearchMutation = useMutation({
    mutationFn: (query) => adminAPI.searchTorrents(query),
    onSuccess: (response) => {
      setTorrentResults(response.data.data || []);
      toast.success(`${response.data.data?.length || 0} torrent bulundu!`);
    },
    onError: (error) => {
      toast.error('Torrent arama hatası: ' + error.message);
    },
  });

  // MKV Search Mutation
  const mkvSearchMutation = useMutation({
    mutationFn: (query) => adminAPI.searchMKV(query),
    onSuccess: (response) => {
      setMkvResults(response.data.data || []);
      toast.success(`${response.data.data?.length || 0} MKV dosyası bulundu!`);
    },
    onError: (error) => {
      toast.error('MKV arama hatası: ' + error.message);
    },
  });

    // Add Subtitle Mutation
  const addSubtitleMutation = useMutation({
    mutationFn: adminAPI.addSubtitle,
    onSuccess: () => {
      toast.success('Altyazı başarıyla eklendi!');
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Altyazı ekleme hatası');
    },
  });

  // Upload Subtitle File Mutation
  const uploadSubtitleMutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('animeId', data.animeId);
      formData.append('episodeNumber', data.episodeNumber);
      formData.append('language', data.language);

              const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BACKEND_URL}/admin/subtitles/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Yükleme başarısız');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Altyazı dosyası başarıyla yüklendi!');
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Dosya yükleme hatası');
    },
  });

  const tabs = [
    { id: 'stats', label: 'İstatistikler', icon: '📊' },
    { id: 'users', label: 'Kullanıcı Yönetimi', icon: '👥' },
    { id: 'episodes', label: '4K Bölümler', icon: '🎬' },
    { id: 'subtitles', label: 'Altyazılar', icon: '💬' },
    { id: 'anime', label: 'Anime Ara', icon: '🔍' },
  ];

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}s ${minutes}dk`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Admin Paneli</h1>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-700 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsLoading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              ) : stats?.data?.data ? (
                <>
                                    <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-6 rounded-lg border border-blue-700/50 hover:border-blue-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">Toplam Kullanıcı</h3>
                      <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-4xl font-bold text-blue-400">{stats.data.data.totalUsers}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Kayıtlı kullanıcılar
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 p-6 rounded-lg border border-green-700/50 hover:border-green-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">Admin Sayısı</h3>
                      <span className="text-2xl">👑</span>
                    </div>
                    <p className="text-4xl font-bold text-green-400">{stats.data.data.totalAdmins}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Aktif yöneticiler
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-6 rounded-lg border border-purple-700/50 hover:border-purple-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">4K Bölüm</h3>
                      <span className="text-2xl">🎥</span>
                    </div>
                    <p className="text-4xl font-bold text-purple-400">{stats.data.data.total4KEpisodes}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Yüksek kalite bölümler
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 p-6 rounded-lg border border-yellow-700/50 hover:border-yellow-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">İzleme Süresi</h3>
                      <span className="text-2xl">⏱️</span>
                    </div>
                    <p className="text-3xl font-bold text-yellow-400">{formatTime(stats.data.data.totalWatchTime)}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Toplam izlenen süre
                    </div>
                  </div>
                                    <div className="bg-gray-800 p-6 rounded-lg md:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>🏆</span>
                      <span>En Çok 4K Bölümü Olan Animeler</span>
                    </h3>
                    <div className="space-y-3">
                                            {stats.data.data.top4KAnime?.slice(0, 5).map((anime, index) => {
                        const maxEpisodes = stats.data.data.top4KAnime[0]?.episode_count || 1;
                        const percentage = (anime.episode_count / maxEpisodes) * 100;
                        return (
                          <div key={anime.anime_id} className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="truncate font-medium">{anime.anime_title}</span>
                              <span className="text-blue-400 font-semibold">{anime.episode_count} bölüm</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                                    <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 p-6 rounded-lg border border-red-700/50 hover:border-red-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">Toplam Yorum</h3>
                      <span className="text-2xl">💬</span>
                    </div>
                    <p className="text-4xl font-bold text-red-400">{stats.data.data.totalComments}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Kullanıcı yorumları
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 p-6 rounded-lg border border-indigo-700/50 hover:border-indigo-500 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-300">Toplam Altyazı</h3>
                      <span className="text-2xl">🎨</span>
                    </div>
                    <p className="text-4xl font-bold text-indigo-400">{stats.data.data.totalSubtitles}</p>
                    <div className="mt-2 text-sm text-gray-400">
                      Altyazı dosyaları
                    </div>
                  </div>
                </>
                            ) : (
                <div className="col-span-full text-center py-8">
                  <div className="text-red-400 mb-2">⚠️ İstatistikler yüklenemedi</div>
                  {statsError && (
                    <div className="text-sm text-gray-400">
                      Hata: {statsError.message}
                    </div>
                  )}
                  <button
                    onClick={() => queryClient.invalidateQueries(['admin-stats'])}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Admin Yetkisi Ver</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    grantAdminMutation.mutate({
                      username: formData.get('username'),
                      permissions: formData.get('permissions') || 'all',
                    });
                    e.target.reset();
                  }}
                  className="flex gap-4"
                >
                  <input
                    type="text"
                    name="username"
                    placeholder="Kullanıcı adı"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                  <select
                    name="permissions"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Tüm Yetkiler</option>
                    <option value="limited">Sınırlı</option>
                  </select>
                  <button
                    type="submit"
                    disabled={grantAdminMutation.isPending}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    {grantAdminMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </form>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Mevcut Adminler</h2>
                {adminsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : admins?.data?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {admins.data.data.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-4">
                                                    <img
                            src={admin.avatar || '/zenshin/default-avatar.png'}
                            alt={admin.username}
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.target.src = '/zenshin/default-avatar.png';
                            }}
                          />
                          <div>
                            <p className="font-medium">{admin.username}</p>
                            <p className="text-sm text-gray-400">
                              {new Date(admin.granted_at).toLocaleDateString('tr-TR')}
                              {admin.granted_by_username && ` - ${admin.granted_by_username} tarafından`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-600 text-xs rounded">
                            {admin.permissions}
                          </span>
                          <button
                            onClick={() => revokeAdminMutation.mutate(admin.username)}
                            disabled={revokeAdminMutation.isPending}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                          >
                            Kaldır
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-2">Henüz admin atanmamış</p>
                    {adminsError && (
                      <p className="text-red-400 text-sm">Hata: {adminsError.message}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4K Episodes Tab */}
          {activeTab === 'episodes' && (
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">4K Bölüm Ekle</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    add4KEpisodeMutation.mutate({
                      anime_id: formData.get('animeId'),
                      anime_title: formData.get('animeTitle'),
                      episode_number: parseInt(formData.get('episodeNumber')),
                      storage_url: formData.get('storageUrl'),
                      file_size: formData.get('fileSize') || null,
                      storage_type: formData.get('storageType') || 'local',
                    });
                    e.target.reset();
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <input
                    type="text"
                    name="animeId"
                    placeholder="Anime ID"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    name="animeTitle"
                    placeholder="Anime Başlığı"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="number"
                    name="episodeNumber"
                    placeholder="Bölüm Numarası"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    name="storageUrl"
                    placeholder="Depolama URL"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    name="fileSize"
                    placeholder="Dosya Boyutu (örn: 2.5GB)"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                  >
                    Ekle
                  </button>
                </form>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Mevcut 4K Bölümler</h2>
                {episodes4kLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : episodes4k?.data?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {episodes4k.data.data.map((episode) => (
                      <div key={episode.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{episode.anime_title}</h3>
                          <p className="text-sm text-gray-400">
                            Bölüm {episode.episode_number} • {episode.file_size} • {episode.storage_type}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(episode.uploaded_at).toLocaleDateString('tr-TR')}
                            {episode.upscaled_by_username && ` - ${episode.upscaled_by_username}`}
                          </p>
                        </div>
                        <button
                          onClick={() => delete4KEpisodeMutation.mutate(episode.id)}
                          disabled={delete4KEpisodeMutation.isPending}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">Henüz 4K bölüm eklenmemiş</p>
                )}
              </div>
            </div>
          )}

                    {/* Subtitles Tab */}
          {activeTab === 'subtitles' && (
            <div className="space-y-6">
                            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>🔍</span>
                  <span>Torrent Ara (Altyazı Paketleri)</span>
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const animeName = formData.get('animeName');
                    const season = formData.get('season');
                    const query = season && season !== 'all' ? `${animeName} S${season}` : animeName;
                    torrentSearchMutation.mutate(query);
                  }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4"
                >
                  <input
                    type="text"
                    name="animeName"
                    placeholder="Anime adı (örn: Jujutsu Kaisen)"
                    className="md:col-span-3 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                    required
                  />
                  <select
                    name="season"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="all">Tüm Sezonlar</option>
                    <option value="1">Sezon 1</option>
                    <option value="2">Sezon 2</option>
                    <option value="3">Sezon 3</option>
                    <option value="4">Sezon 4</option>
                    <option value="5">Sezon 5</option>
                  </select>
                  <button
                    type="submit"
                    disabled={torrentSearchMutation.isPending}
                    className="md:col-span-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {torrentSearchMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Aranıyor...</span>
                      </>
                    ) : (
                      <span>🔍 Torrent Ara</span>
                    )}
                  </button>
                </form>
                <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-sm text-blue-300">
                  <strong>💡 İpucu:</strong> Altyazı paketleri batch torrentler halinde gelir. İndirdikten sonra altyazıları çıkartabilirsiniz.
                </div>

                                {/* Torrent Results */}
                {torrentResults.length > 0 && (
                  <div className="mt-6 space-y-3 max-h-[600px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-blue-400">Sonuçlar ({torrentResults.length})</h3>
                      <span className="text-sm text-gray-400">En fazla 100 sonuç gösteriliyor</span>
                    </div>
                    {torrentResults.map((torrent, index) => (
                      <div key={index} className="bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{torrent.title}</h4>
                            <div className="flex gap-4 text-sm text-gray-400">
                              <span>📁 {torrent.size}</span>
                              <span>📥 {torrent.seeders} seeds</span>
                              <span>📤 {torrent.leechers} peers</span>
                              <span>📅 {torrent.date}</span>
                            </div>
                          </div>
                          <a
                            href={torrent.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                          >
                            <DownloadIcon />
                            <span>İndir</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                                          <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>🎬</span>
                  <span>MKV Ara (Tek Bölümler)</span>
                </h2>
                <form
                                    onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const animeName = formData.get('animeName');
                    const season = formData.get('season');
                    let episodeNum = formData.get('episodeNum');
                    
                    // Remove leading zeros (01 -> 1, 05 -> 5)
                    episodeNum = episodeNum.replace(/^0+/, '') || '0';
                    
                    let query = animeName;
                    if (season && season !== 'all') {
                      query += ` S${season}`;
                    }
                    if (episodeNum) {
                      query += ` ${episodeNum}`;
                    }
                    
                    console.log('🔍 MKV Search query:', query);
                    mkvSearchMutation.mutate(query);
                  }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4"
                >
                  <input
                    type="text"
                    name="animeName"
                    placeholder="Anime adı (örn: Frieren)"
                    className="md:col-span-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                    required
                  />
                  <select
                    name="season"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="all">Tüm Sezonlar</option>
                    <option value="1">Sezon 1</option>
                    <option value="2">Sezon 2</option>
                    <option value="3">Sezon 3</option>
                    <option value="4">Sezon 4</option>
                    <option value="5">Sezon 5</option>
                  </select>
                  <input
                    type="text"
                    name="episodeNum"
                    placeholder="Bölüm (01, 1, 05...)"
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={mkvSearchMutation.isPending}
                    className="md:col-span-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {mkvSearchMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Aranıyor...</span>
                      </>
                    ) : (
                      <span>🔍 Tekil Bölüm Ara</span>
                    )}
                  </button>
                </form>
                <div className="mt-3 p-3 bg-purple-900/30 border border-purple-700 rounded-lg text-sm text-purple-300">
                  <strong>👁️ Not:</strong> Batch pack'ler (1-12, 01-24 gibi) otomatik filtrelenir. Sadece tekil bölümler görüntülenir.
                </div>

                                {/* MKV Results */}
                {mkvResults.length > 0 && (
                  <div className="mt-6 space-y-3 max-h-[600px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-purple-400">MKV Dosyaları ({mkvResults.length})</h3>
                      <span className="text-sm text-gray-400">Tekil bölümler</span>
                    </div>
                    {mkvResults.map((mkv, index) => (
                      <div key={index} className="bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{mkv.title}</h4>
                            <div className="flex gap-4 text-sm text-gray-400">
                              <span>📁 {mkv.size}</span>
                              <span>📥 {mkv.seeders} seeds</span>
                              <span>📤 {mkv.leechers} peers</span>
                              <span>📅 {mkv.date}</span>
                            </div>
                          </div>
                          <a
                            href={mkv.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                          >
                            <DownloadIcon />
                            <span>İndir</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                            <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>➕</span>
                  <span>Altyazı Ekle</span>
                </h2>

                {/* Upload Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      uploadMode === 'url'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🔗 URL ile Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      uploadMode === 'file'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📁 Dosya Yükle
                  </button>
                </div>

                {/* URL Mode */}
                {uploadMode === 'url' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      addSubtitleMutation.mutate({
                        animeId: formData.get('animeId'),
                        episodeNumber: parseInt(formData.get('episodeNumber')),
                        language: formData.get('language'),
                        fileName: formData.get('fileName'),
                        storageUrl: formData.get('storageUrl'),
                      });
                      e.target.reset();
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <input
                      type="text"
                      name="animeId"
                      placeholder="Anime ID (Anilist)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="number"
                      name="episodeNumber"
                      placeholder="Bölüm Numarası"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="text"
                      name="language"
                      placeholder="Dil kodu (tr, en, jp)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="text"
                      name="fileName"
                      placeholder="Dosya adı (episode01.srt)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="url"
                      name="storageUrl"
                      placeholder="Altyazı URL (https://...)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 md:col-span-2 text-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={addSubtitleMutation.isPending}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium md:col-span-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {addSubtitleMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Ekleniyor...</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon />
                          <span>Altyazı Ekle</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* File Upload Mode */}
                {uploadMode === 'file' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      
                      if (!selectedFile) {
                        toast.error('Lütfen bir dosya seçin');
                        return;
                      }

                      uploadSubtitleMutation.mutate({
                        file: selectedFile,
                        animeId: formData.get('animeId'),
                        episodeNumber: parseInt(formData.get('episodeNumber')),
                        language: formData.get('language'),
                      });
                      e.target.reset();
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <input
                      type="text"
                      name="animeId"
                      placeholder="Anime ID (Anilist)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="number"
                      name="episodeNumber"
                      placeholder="Bölüm Numarası"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    <input
                      type="text"
                      name="language"
                      placeholder="Dil kodu (tr, en, jp)"
                      className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                      required
                    />
                    
                    {/* File Input */}
                    <div className="md:col-span-1">
                      <label
                        htmlFor="subtitle-file"
                        className="flex items-center justify-center px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors text-white"
                      >
                        <span className="mr-2">📁</span>
                        <span>{selectedFile ? selectedFile.name : 'Dosya Seç'}</span>
                      </label>
                      <input
                        id="subtitle-file"
                        type="file"
                        accept=".srt,.ass,.vtt,.7z,.zip"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            toast.success(`Seçildi: ${file.name}`);
                          }
                        }}
                      />
                    </div>

                    {selectedFile && (
                      <div className="md:col-span-2 p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm text-green-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>✅ Dosya Hazır:</strong> {selectedFile.name}
                            <span className="ml-2 text-gray-400">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              toast.info('Dosya seçimi iptal edildi');
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={uploadSubtitleMutation.isPending || !selectedFile}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium md:col-span-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploadSubtitleMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          <span>Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon />
                          <span>Dosya Yükle</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-sm text-blue-300">
                  <strong>💡 İpucu:</strong> {uploadMode === 'url' 
                    ? 'Altyazıları yukarıdaki torrent aramadan bulabilir, indirip bir yere yükledikten sonra URL\'ini buraya girebilirsiniz.'
                    : 'Desteklenen formatlar: .srt, .ass, .vtt, .7z, .zip - Dosyalar sunucuya yüklenecek.'}
                </div>
              </div>
            </div>
                    )}

          {/* Anime Search Tab */}
          {activeTab === 'anime' && (
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>🔍</span>
                  <span>Anilist'ten Anime Ara</span>
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const query = formData.get('query');
                    setSearchQuery(query);
                    animeSearchMutation.mutate(query);
                  }}
                  className="flex gap-4"
                >
                  <input
                    type="text"
                    name="query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Anime adı ara... (örn: Frieren, One Piece)"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={animeSearchMutation.isPending}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {animeSearchMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Aranıyor...</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon />
                        <span>Ara</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Anime Search Results */}
                {animeSearchMutation.data?.data?.data && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">
                      Sonuçlar ({animeSearchMutation.data.data.data.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                      {animeSearchMutation.data.data.data.map((anime) => (
                        <div
                          key={anime.id}
                          className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-650 transition-all cursor-pointer"
                          onClick={() => setSelectedAnime(anime)}
                        >
                          <div className="relative aspect-[3/4]">
                            <img
                              src={anime.coverImage?.extraLarge || anime.coverImage?.large}
                              alt={anime.title?.romaji || anime.title?.english}
                              className="w-full h-full object-cover"
                            />
                            {anime.status && (
                              <span className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-xs rounded">
                                {anime.status}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <h4 className="font-semibold text-white line-clamp-2 mb-1">
                              {anime.title?.romaji || anime.title?.english}
                            </h4>
                            {anime.title?.english && anime.title.english !== anime.title.romaji && (
                              <p className="text-xs text-gray-400 line-clamp-1 mb-2">
                                {anime.title.english}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span>🎬 {anime.format || 'N/A'}</span>
                              <span>📺 {anime.episodes || '?'} eps</span>
                            </div>
                            <div className="mt-2">
                              <span className="text-xs text-blue-400">ID: {anime.id}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Anime Details Modal */}
                {selectedAnime && (
                  <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedAnime(null)}>
                    <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="p-6">
                        <div className="flex gap-6">
                          <img
                            src={selectedAnime.coverImage?.extraLarge || selectedAnime.coverImage?.large}
                            alt={selectedAnime.title?.romaji}
                            className="w-48 h-64 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white mb-2">
                              {selectedAnime.title?.romaji}
                            </h2>
                            {selectedAnime.title?.english && (
                              <p className="text-gray-400 mb-3">{selectedAnime.title?.english}</p>
                            )}
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2">
                                <span className="text-gray-400">Anilist ID:</span>
                                <span className="text-blue-400 font-mono">{selectedAnime.id}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400">Format:</span>
                                <span className="text-white">{selectedAnime.format || 'N/A'}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400">Durum:</span>
                                <span className="text-white">{selectedAnime.status || 'N/A'}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400">Bölümler:</span>
                                <span className="text-white">{selectedAnime.episodes || 'Bilinmiyor'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedAnime.id.toString());
                              toast.success('Anime ID kopyalandı!');
                            }}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                          >
                            📋 ID'yi Kopyala
                          </button>
                          <button
                            onClick={() => setSelectedAnime(null)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
                          >
                            Kapat
                          </button>
                        </div>

                        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-300">
                          <strong>💡 Bilgi:</strong> Bu ID'yi 4K bölüm veya altyazı eklerken kullanabilirsiniz.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-6 rounded-lg border border-blue-700">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span>🚀</span>
                    <span>Hızlı İşlemler</span>
                  </h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>• Anime ara ve ID'sini öğren</p>
                    <p>• 4K bölüm eklemek için kullan</p>
                    <p>• Altyazı eklemek için kullan</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-6 rounded-lg border border-purple-700">
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span>📚</span>
                    <span>Kullanım Kılavuzu</span>
                  </h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>1. Anime adını ara</p>
                    <p>2. Doğru anime'ye tıkla</p>
                    <p>3. Anilist ID'yi kopyala</p>
                    <p>4. Diğer sekmelerde kullan</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
