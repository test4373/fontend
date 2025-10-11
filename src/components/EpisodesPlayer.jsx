import { Button } from "@radix-ui/themes";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function EpisodesPlayer({
  file,
  handleStreamBrowser,
  handleStreamVlc,
  handleStreamMpv,
  setCurrentEpisode,
  getFiles,
  handleRemoveTorrent,
  videoSrc,
}) {
  const [isActive, setIsActive] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      onClick={() => setIsActive(!isActive)}
      className="relative m-2 animate-fade-down cursor-default border border-gray-700 p-2 font-space-mono transition-all duration-100 ease-in-out animate-duration-500 hover:bg-[#1e1e20]"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-x-1 font-space-mono font-medium opacity-90">
          <div>
            <p className="flex gap-x-2 font-space-mono text-sm font-medium text-gray-400 opacity-90">
              <span className="flex items-center gap-2"></span>
              {file.name}
            </p>
            {isActive && (
              <div className="ml-2 mt-2 flex animate-fade-down gap-x-3 animate-duration-500">
                <Button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setCurrentEpisode(file.name);
                    await getFiles();
                    handleStreamBrowser(file.name);
                  }}
                  size="2"
                  color="blue"
                  variant="solid"
                  className="font-medium"
                >
                  {t("player.streamOnBrowser")}
                </Button>
                <Button
                  size="2"
                  color="purple"
                  variant="solid"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setCurrentEpisode(file.name);
                    await getFiles();
                    handleStreamMpv(file.name);
                  }}
                  className="font-medium"
                >
                  {t("player.openInMPV") || 'MPV ile Aç'}
                </Button>
                <Button
                  size="2"
                  color="orange"
                  variant="solid"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setCurrentEpisode(file.name);
                    await getFiles();
                    handleStreamVlc(file.name);
                  }}
                  className="font-medium"
                >
                  {t("player.openInVLC")}
                </Button>
                {videoSrc && (
                  <Button
                    size="2"
                    color="red"
                    variant="solid"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTorrent();
                    }}
                    className="font-medium"
                  >
                    {t('stopAndRemoveAnime') || 'Animeyi Durdur ve Kaldır'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
