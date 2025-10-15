import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useGetNewReleases from '../hooks/useGetNewReleases';
import CenteredLoader from '../ui/CenteredLoader';
import NewReleaseCard from '../components/NewReleaseCard';
import useGetMultipleAnilistIds from '../hooks/useGetMultipleAnilistIds';
import { toast } from 'sonner';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import ScrollToTop from '../components/ScrollToTop';

export default function NewReleases() {
  const { t } = useTranslation();
  const packer = '[SubsPlease]';
  const { isLoading, data, error, status } = useGetNewReleases(packer);
  const [newReleases, setNewReleases] = useState([]);
  const [displayedReleases, setDisplayedReleases] = useState([]);
  const [cardErrorShown, setCardErrorShown] = useState(false);
  const totalCards = 20;

  useEffect(() => {
    if (data && Array.isArray(data)) {
      console.log('🔥 Total releases:', data.length);
      
      // Kalite skoru fonksiyonu
      const getQualityScore = (title) => {
        if (!title) return 0;
        if (title.includes('1080p')) return 1000;
        if (title.includes('720p')) return 100;
        if (title.includes('480p')) return 10;
        return 1;
      };
      
      // Title'dan kalite ve hash'i kaldırarak base title oluştur
      const getBaseTitle = (title) => {
        if (!title) return '';
        return title
          .replace(/\(1080p\)|\(720p\)|\(480p\)/gi, '') // Kaliteyi kaldır
          .replace(/\[\w+\]/g, '') // Hash'leri kaldır ([12FA4FBE] gibi)
          .replace(/\.mkv$/i, '') // .mkv uzantısını kaldır
          .trim();
      };
      
      // Her UNIQUE TITLE için en yüksek kaliteyi tut
      const titleQualityMap = new Map();
      
      data.forEach(release => {
        const baseTitle = getBaseTitle(release.title);
        if (!baseTitle) return;
        
        const currentScore = getQualityScore(release.title);
        
        if (!titleQualityMap.has(baseTitle)) {
          titleQualityMap.set(baseTitle, { release, score: currentScore });
        } else {
          const existing = titleQualityMap.get(baseTitle);
          // Sadece daha yüksek kalite varsa değiştir
          if (currentScore > existing.score) {
            titleQualityMap.set(baseTitle, { release, score: currentScore });
          }
        }
      });
      
      const uniqueReleases = Array.from(titleQualityMap.values()).map(item => item.release);
      
      console.log('✅ FINAL unique releases (highest quality):', uniqueReleases.length);
      
      // Tarihe göre sırala (en yeni önce)
      const sortedReleases = uniqueReleases.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });
      
      setNewReleases(sortedReleases.slice(0, 12));
      setDisplayedReleases(sortedReleases.slice(0, totalCards));
    }
  }, [data]);

  const [anilistIds, setAnilistIds] = useState([]);

  const {
    isLoading: isLoadingAnilist,
    data: dataAnilist,
    error: errorAnilist,
  } = useGetMultipleAnilistIds(anilistIds);

  useEffect(() => {
    if (newReleases.length > 0) {
      const ids = newReleases.map(release => release.anilistId);
      setAnilistIds(ids);
    }
  }, [newReleases]);

  useEffect(() => {
    if (errorAnilist && !cardErrorShown) {
      toast.error(t('errorFetchingAnilistData'), {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: t('anilistDataFetchError'),
        classNames: {
          title: "text-rose-500",
        },
      });
      setCardErrorShown(true);
    }
  }, [errorAnilist, cardErrorShown, t]);

  useEffect(() => {
    if (anilistIds.length > 0 && dataAnilist && Array.isArray(dataAnilist)) {
      setDisplayedReleases(prev => prev.map(release => {
        const anilistData = dataAnilist.find(data => data.id === release.anilistId);
        return { ...release, anilistData };
      }));
    }
  }, [anilistIds, dataAnilist]);

  if (isLoading) {
    return <CenteredLoader />;
  }

  if (error) {
    toast.error(t('errorFetchingNewReleases'), {
      icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
      description: t('newReleasesFetchError'),
      classNames: {
        title: "text-rose-500",
      },
    });
    return (
      <div className="p-12">
        <div className="border-b border-gray-700 pb-3 font-space-mono text-lg tracking-wider">
          {t('newReleases.title')}
        </div>
        <div className="grid animate-fade grid-cols-4">
          <p>{t('errorFetchingNewReleases')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-12">
      <div className="border-b border-gray-700 pb-3 font-space-mono text-lg tracking-wider">
        {t('newReleases.title')}
      </div>
      <div className="grid animate-fade grid-cols-4">
        {displayedReleases.map((release) => (
          <NewReleaseCard
            key={release.title}
            data={release}
            cardErrorShown={cardErrorShown}
            setCardErrorShown={setCardErrorShown}
            anilistIds={anilistIds}
            setAnilistIds={setAnilistIds}
            dataAnilist={dataAnilist}
          />
        ))}
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
