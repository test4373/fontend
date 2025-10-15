import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function CompletedAnimeGrid({ animes }) {
  const { t } = useTranslation();

  if (!animes || animes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        {t('profile.noCompletedAnime')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {animes.map((anime) => (
        <Link
          key={anime.anime_id}
          to={`/anime/${anime.anime_id}`}
          className="group rounded-lg border border-gray-700 bg-[#1d1d20] overflow-hidden transition hover:bg-[#2a2a2e]"
        >
          <div className="relative">
            <img
              src={anime.anime_image}
              alt={anime.anime_title}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
            />
            {anime.rating && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                ✓ {anime.rating}/10
              </div>
            )}
          </div>

          <div className="p-3">
            <h3 className="font-bold text-sm line-clamp-2">{anime.anime_title}</h3>
            <p className="text-xs text-gray-400 mt-1">
              {t('profile.completedOn')} {new Date(anime.completed_at).toLocaleDateString()}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
