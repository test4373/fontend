import SearchBar from "./SearchBar";
import { Link } from "react-router-dom";
import zenshinLogo from "../assets/zenshinLogo.png";
import {
  DividerVerticalIcon,
  GitHubLogoIcon,
  PersonIcon,
  ShadowIcon,
  ShadowNoneIcon,
  DownloadIcon,
} from "@radix-ui/react-icons";
import { Button, DropdownMenu, Tooltip } from "@radix-ui/themes";
import { useZenshinContext } from "../utils/ContextProvider";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function Header({ theme }) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const zenshinContext = useZenshinContext();

  function toggleGlow() {
    zenshinContext.setGlow(!zenshinContext.glow);
  }

  return (
    <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-[#5a5e6750] bg-[#111113] bg-opacity-60 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center justify-center gap-x-2">
        <Link
          className="hover: font-spaceMono flex w-fit cursor-pointer select-none gap-x-2 rounded-sm p-1 text-sm transition-all duration-200 hover:bg-[#70707030]"
          to={"/"}
        >
          <img src={zenshinLogo} alt="" className="w-16" />
        </Link>
        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <a
          href="https://github.com/hitarth-gg"
          target="_blank"
          rel="noreferrer"
        >
          <Button color="gray" variant="ghost" size={"1"}>
            <GitHubLogoIcon className="my-1" width={17} height={17} />
          </Button>
        </a>
        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <Button color="gray" variant="ghost" size={"1"}>
          <Link to="/newreleases">
            <div className="p-1 font-space-mono text-[.8rem]">{t('header.newReleases')}</div>
          </Link>
        </Button>
        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <Button color="gray" variant="ghost" size={"1"}>
          <Link to="/browse">
            <div className="p-1 font-space-mono text-[.8rem]">{t('header.browseAnime')}</div>
          </Link>
        </Button>
        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <Tooltip content={t('header.downloads') || 'Active Downloads'}>
          <Button color="gray" variant="ghost" size={"1"}>
            <Link to="/downloads">
              <DownloadIcon className="my-1" width={16} height={16} />
            </Link>
          </Button>
        </Tooltip>
      </div>

      <div className="w-2/6">
        <SearchBar />
      </div>
      <div className="flex items-center justify-center gap-x-8">
        {!isAuthenticated && (
          <Link to="/login">
            <Button color="gray" variant="ghost" size={"1"}>
              <PersonIcon className="my-1" width={16} height={16} />
              <span className="ml-1">{t('auth.login')}</span>
            </Button>
          </Link>
        )}
        {isAuthenticated && user && (
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger>
              <Button variant="ghost" color="gray">
                <div className="flex animate-fade items-center gap-x-2">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt="avatar"
                    className="h-6 w-6 rounded-full"
                  />
                  <div className="font-space-mono text-[.8rem]">
                    {user.username}
                  </div>
                </div>
                <DropdownMenu.TriggerIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item asChild>
                <Link to="/profile">{t('profile.myProfile')}</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link to="/edit-profile">{t('profile.editProfile')}</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item color="red" onClick={logout}>
                {t('auth.logout')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}

        <Link target="_blank" to="https://github.com/hitarth-gg/zenshin">
          <Button color="gray" variant="ghost" size={"1"}>
            <div className="p-1 text-[.8rem]">{t('header.howToUse')}</div>
          </Button>
        </Link>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger>
            <Button color="gray" variant="ghost" size={"1"}>
              {t('header.language')}
              <DropdownMenu.TriggerIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => i18n.changeLanguage('en')}>English</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => i18n.changeLanguage('tr')}>Türkçe</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Button
          color="gray"
          variant="ghost"
          size={"1"}
          onClick={() => toggleGlow()}
        >
          {zenshinContext.glow ? (
            <ShadowIcon className="my-1" width={16} height={16} />
          ) : (
            <ShadowNoneIcon className="my-1" width={16} height={16} />
          )}
        </Button>
      </div>
    </div>
  );
}
