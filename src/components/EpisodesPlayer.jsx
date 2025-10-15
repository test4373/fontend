export default function EpisodesPlayer({
  file,
  handleStreamBrowser,
  setCurrentEpisode,
  getFiles,
  videoSrc,
}) {
  return (
    <div
      onClick={async () => {
        setCurrentEpisode(file.name);
        await getFiles();
        handleStreamBrowser(file.name);
      }}
      className="relative m-2 animate-fade-down cursor-pointer border border-gray-700 p-4 font-space-mono transition-all duration-200 ease-in-out animate-duration-500 hover:bg-[#1e1e20] hover:border-violet-500/50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎬</span>
          <p className="font-space-mono text-sm font-medium text-gray-300">
            {file.name}
          </p>
        </div>
        <span className="text-violet-400 text-sm font-bold">▶️ Play</span>
      </div>
    </div>
  );
}
