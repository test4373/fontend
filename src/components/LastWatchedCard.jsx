import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function LastWatchedCard({ anime }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!anime) return null;

  const handleClick = () => {
    // If magnet_uri exists, go directly to player
    // Otherwise go to anime page
    if (anime.magnet_uri) {
      navigate(
        `/player/${encodeURIComponent(anime.magnet_uri)}/${anime.anime_id}/${anime.progress || 0}/${anime.episode_number}`,
        {
          state: {
            data: {
              id: parseInt(anime.anime_id),
              title: {
                romaji: anime.anime_title,
                english: anime.anime_title
              },
              coverImage: {
                large: anime.anime_image,
                extraLarge: anime.anime_image
              },
              image: anime.anime_image
            }
          }
        }
      );
    } else {
      navigate(`/anime/${anime.anime_id}`, {
        state: {
          scrollToEpisode: anime.episode_number
        }
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex gap-4 rounded-lg border border-gray-700 bg-[#1d1d20] p-4 transition hover:bg-[#2a2a2e] cursor-pointer"
    >
      <img
        src={anime.anime_image}
        alt={anime.anime_title}
        className="h-32 w-24 rounded object-cover"
      />

      <div className="flex-1">
        <h3 className="text-lg font-bold">{anime.anime_title}</h3>
        <p className="text-gray-400">
          {t('profile.episode')} {anime.episode_number}
        </p>
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${anime.progress || 0}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-gray-400">
            {anime.progress?.toFixed(1) || 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
