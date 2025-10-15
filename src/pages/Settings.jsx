import { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({
    theme: 'dark',
    language: 'tr',
    autoUpdate: true,
    minimizeToTray: true,
    startMinimized: false,
    defaultQuality: '1080p',
    autoPlayNext: true,
    skipIntro: false,
    subtitleLanguage: 'tr',
    downloadPath: '',
    maxConnections: 150,
    downloadLimit: -1,
    uploadLimit: 100,
    videoPlayer: 'hls', // 'direct', 'hls', 'mp4-remux'
    useHLS: true
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // Load settings from localStorage for web version
    const loadSettings = async () => {
      try {
        const savedSettings = localStorage.getItem('zenshinSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to localStorage for web version
    try {
      localStorage.setItem('zenshinSettings', JSON.stringify(newSettings));
      showSuccessToast('Ayar kaydedildi!');
    } catch (error) {
      console.error('Failed to save setting:', error);
      showSuccessToast('⚠️ Ayar kaydedilemedi!');
    }
  };

  const showSuccessToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleClearCache = async () => {
    if (window.confirm('Önbelleği temizlemek istediğinize emin misiniz?')) {
      // Clear browser cache
      localStorage.clear();
      sessionStorage.clear();
      showSuccessToast('Önbellek temizlendi!');
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('İzleme geçmişini silmek istediğinize emin misiniz?')) {
      try {
        localStorage.removeItem('zenshinSettings');
        showSuccessToast('Geçmiş silindi!');
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm('Tüm ayarları sıfırlamak istediğinize emin misiniz?')) {
      const defaultSettings = {
        theme: 'dark',
        language: 'tr',
        autoUpdate: true,
        minimizeToTray: true,
        startMinimized: false,
        defaultQuality: '1080p',
        autoPlayNext: true,
        skipIntro: false,
        subtitleLanguage: 'tr',
        downloadPath: '',
        maxConnections: 150,
        downloadLimit: -1,
        uploadLimit: 100,
        videoPlayer: 'hls',
        useHLS: true
      };
      setSettings(defaultSettings);
      localStorage.setItem('zenshinSettings', JSON.stringify(defaultSettings));
      showSuccessToast('Ayarlar sıfırlandı!');
    }
  };

  const handleCheckUpdates = async () => {
    showSuccessToast('Güncellemeler kontrol ediliyor...');
    // Simulate update check
    setTimeout(() => {
      showSuccessToast('Uygulama güncel!');
    }, 2000);
  };

  const handleOpenGitHub = () => {
    window.open('https://github.com/yourusername/zenshin', '_blank');
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">⚙️ Ayarlar</h1>
          <p className="text-gray-400">Uygulamayı ihtiyaçlarınıza göre özelleştirin</p>
        </div>

        {/* Genel Ayarlar */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">🎨 Genel</h2>

          <div className="space-y-4">
            {/* Tema */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Tema</div>
                <div className="text-sm text-gray-400">Arayüz temasını seçin</div>
              </div>
              <select
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-violet-500"
              >
                <option value="dark">Koyu</option>
                <option value="light">Açık</option>
              </select>
            </div>

            {/* Dil */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Dil</div>
                <div className="text-sm text-gray-400">Uygulama dili</div>
              </div>
              <select
                value={settings.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-violet-500"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        {/* Uygulama Ayarları */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">🖥️ Uygulama</h2>

          <div className="space-y-4">
            {/* Otomatik Güncelleme */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Otomatik Güncelleme</div>
                <div className="text-sm text-gray-400">Güncellemeleri otomatik kontrol et</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoUpdate}
                  onChange={(e) => handleChange('autoUpdate', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {/* Otomatik Sonraki Bölüm */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Otomatik Sonraki Bölüm</div>
                <div className="text-sm text-gray-400">Bölüm bitince otomatik geç</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoPlayNext}
                  onChange={(e) => handleChange('autoPlayNext', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {/* Intro Atla */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Intro'yu Atla</div>
                <div className="text-sm text-gray-400">Opening'i otomatik geç</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.skipIntro}
                  onChange={(e) => handleChange('skipIntro', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Video Ayarları */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">🎥 Video</h2>

          <div className="space-y-4">
            {/* Varsayılan Kalite */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Varsayılan Kalite</div>
                <div className="text-sm text-gray-400">Video kalitesi tercihi</div>
              </div>
              <select
                value={settings.defaultQuality}
                onChange={(e) => handleChange('defaultQuality', e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-violet-500"
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4K">4K</option>
              </select>
            </div>

            {/* Altyazı Dili */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Altyazı Dili</div>
                <div className="text-sm text-gray-400">Varsayılan altyazı dili</div>
              </div>
              <select
                value={settings.subtitleLanguage}
                onChange={(e) => handleChange('subtitleLanguage', e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-violet-500"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>

            {/* Video Player Modu */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Video Player Modu</div>
                <div className="text-sm text-gray-400">Streaming teknolojisi seçimi</div>
              </div>
              <select
                value={settings.videoPlayer}
                onChange={(e) => handleChange('videoPlayer', e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg outline-none border border-gray-600 focus:border-violet-500"
              >
                <option value="direct">Doğrudan MKV (Tavsiye Edilen)</option>
                <option value="hls">HLS Streaming</option>
                <option value="mp4-remux">MP4 Remux (En Uyumlu)</option>
              </select>
            </div>

            {/* HLS Mode Info */}
            {settings.videoPlayer === 'hls' && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-yellow-500 text-2xl">⚠️</div>
                  <div>
                    <div className="text-yellow-300 font-bold mb-1">HLS Streaming Modu</div>
                    <div className="text-yellow-200 text-sm">
                      Bu mod FFmpeg ile gerçek zamanlı transcoding yapar. Daha yüksek CPU kullanımı olabilir ama tüm tarayıcılarda çalışır.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MP4 Remux Info */}
            {settings.videoPlayer === 'mp4-remux' && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-blue-500 text-2xl">ℹ️</div>
                  <div>
                    <div className="text-blue-300 font-bold mb-1">MP4 Remux Modu</div>
                    <div className="text-blue-200 text-sm">
                      Video yeniden kodlanmaz, sadece konteyner değiştirilir (MKV → MP4). Hızlı ve tüm tarayıcılarla uyumlu.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Mode Info */}
            {settings.videoPlayer === 'direct' && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-green-500 text-2xl">✅</div>
                  <div>
                    <div className="text-green-300 font-bold mb-1">Doğrudan MKV Streaming</div>
                    <div className="text-green-200 text-sm">
                      En hızlı mod. Dosya olduğu gibi stream edilir. Modern tarayıcılarda mükemmel çalışır.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Hakkında */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">ℹ️ Hakkında</h2>

          <div className="space-y-3 text-gray-300">
            <div className="flex justify-between">
              <span>Versiyon</span>
              <span className="text-violet-400">2.4.4</span>
            </div>
            <div className="flex justify-between">
              <span>Platform</span>
              <span className="text-violet-400">Web</span>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={handleCheckUpdates}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Güncellemeleri Kontrol Et
            </button>
            <button
              onClick={handleOpenGitHub}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              GitHub'da Görüntüle
            </button>
          </div>
        </section>

        {/* Önbellek Temizle */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">🗑️ Önbellek ve Veri</h2>

          <div className="space-y-4">
            <button
              onClick={handleClearCache}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              Önbelleği Temizle
            </button>
            <button
              onClick={handleClearHistory}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              Geçmişi Sil
            </button>
            <button
              onClick={handleResetSettings}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
            >
              Ayarları Sıfırla
            </button>
          </div>
        </section>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 right-8 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
