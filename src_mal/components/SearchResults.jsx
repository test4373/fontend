import { format } from "date-fns";
import { SEARCH_TORRENT } from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function SearchResults({ data, setIsActive }) {
  const navigate = useNavigate();
  function handleClick() {
    navigate(`/anime/${data.mal_id}`);
    setIsActive(false);
  }

  return (
    <div
      onClick={() => handleClick()}
      className="flex animate-fade cursor-pointer gap-x-5 rounded-md bg-[#111113] px-2 py-1 font-inter transition-all duration-200 ease-in-out hover:scale-105 hover:bg-[#232326] hover:z-10"
    >
      <img
        className="duration-400 h-12 w-12 animate-fade rounded-lg object-cover transition-all ease-in-out hover:scale-150"
        src={data.images.jpg.image_url}
        alt="img"
      />
      <div className="flex w-[85%] flex-col">
        <div className="w-full truncate text-sm font-medium opacity-80">
          {data.title}
        </div>

        <div>
          <p className="text-xs opacity-45">
            {data.type} - {`${data.episodes ? data.episodes : "?"} episodes`} (
            {data.status})
          </p>
          <p className="text-xs opacity-45">
            {format(new Date(data.aired.from), "MMMM yyyy")}
          </p>
        </div>
      </div>
    </div>
  );
}
