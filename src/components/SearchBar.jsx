import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Code, Spinner, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import SearchResults from "./SearchResults";
import { searchAnime } from "../utils/helper";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [searchData, setSearchData] = useState([]);
  const [isActive, setIsActive] = useState(false);

  const inputRef = useRef(null);
  const searchBarRef = useRef(null);

  console.log(searchText);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchBarRef.current &&
        !searchBarRef.current.contains(event.target)
      ) {
        setIsActive(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchBarRef]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchData([]);
    setSearchText(value);
    
    // Gizli admin şifresi kontrolü
    const ADMIN_SECRET = "ZenshinAdmin@2024!PowerMode";
    if (value === ADMIN_SECRET) {
      toast.success('🛡️ Admin Access Granted!', {
        description: 'Redirecting to admin panel...',
        duration: 1500
      });
      setTimeout(() => {
        navigate('/admin');
        setSearchText('');
        setIsActive(false);
      }, 1500);
    }
  };

  const [searching, setSearching] = useState(false);
  const handleSearchText = useCallback(async function handleSearchText(
    searchText,
  ) {
    if (searchText) {
      setSearching(true);
      const data = await searchAnime(searchText);
      setSearching(false);
      setSearchData(data);
    } else {
      toast.error(t('searchBar.invalidQuery'), {
        icon: <MagnifyingGlassIcon height="16" width="16" color="#ffffff" />,
        description: t('searchBar.enterValidQuery'),
        classNames: {
          title: "text-rose-500",
        },
      });
      return;
    }
  }, [t]);

  console.log(searchData);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (
        event.key === "Enter" &&
        inputRef.current === document.activeElement
      ) {
        handleSearchText(searchText);
      }
      if (event.ctrlKey && event.key === "k") {
        event.preventDefault();
        inputRef.current.select();
        inputRef.current.focus();
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleSearchText, searchText]);

  return (
    <div ref={searchBarRef} className="relative">
      <TextField.Root
        placeholder={t('searchBar.placeholder')}
        onInput={handleSearchChange}
        ref={inputRef}
        type="text"
        value={searchText}
        onFocus={() => setIsActive(true)}
        // onBlur={() => setIsActive(false)}
      >
        <TextField.Slot>
          <MagnifyingGlassIcon height="16" width="16" />
        </TextField.Slot>
        <TextField.Slot
          className="transition-all duration-100 ease-in-out hover:cursor-pointer hover:bg-[#5a5e6750]"
          onClick={() => handleSearchText(searchText)}
        >
          <Code size={"1"} color="gray" variant="outline">
            ctrl
          </Code>
          <Code size={"1"} color="gray" variant="outline">
            k
          </Code>
        </TextField.Slot>
      </TextField.Root>

      {isActive && (
        <div className="absolute mt-2 flex w-full animate-fade-down flex-col justify-center animate-duration-[400ms]">
          {searching && (
            <div className="flex flex-col items-center justify-center gap-y-5">
              <Spinner />
            </div>
          )}

          {searchData?.map((x) => (
            <SearchResults key={x.id} data={x} setIsActive={setIsActive} />
          ))}
        </div>
      )}
    </div>
  );
}
