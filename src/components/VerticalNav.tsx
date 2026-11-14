"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import anime from "animejs";
import ThemeToggle from "./ThemeToggle";
import AboutButton from "./AboutButton";
import {
  BookOpenIcon,
  FolderIcon,
  SettingsIcon,
  GridIcon,
  TranslateIcon,
  UsersIcon,
  UserIcon,
} from "./ui/icons";

export default function VerticalNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isAuthenticated = status === "authenticated";
  const isOwner =
    (session as any)?.isOwner === true ||
    (session?.user as any)?.role === "ADMIN";
  const [folderLink, setFolderLink] = useState<string | null>(null);

  // Refs for anime.js Bottom App Bar & Desktop Dock animations
  const bottomBarRef = useRef<HTMLElement>(null);
  const bottomLinksWrapRef = useRef<HTMLDivElement>(null);
  const bottomPillRef = useRef<HTMLDivElement>(null);
  const bottomItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const bottomIconRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const desktopIconRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    fetch("/api/folder")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.webViewLink && setFolderLink(d.webViewLink))
      .catch(() => {});
  }, [status, isOwner]);

  const navItems = useMemo(
    () => [
      {
        href: "/",
        label: "Dashboard",
        icon: GridIcon,
        active: pathname === "/",
        iconClass: "text-brand-500 dark:text-brand-400",
      },
      {
        href: "/library",
        label: "Personal Library",
        icon: BookOpenIcon,
        active: pathname === "/library" || pathname?.startsWith("/book/"),
        iconClass: "text-indigo-500 dark:text-indigo-400",
      },
      {
        href: "/translate",
        label: "AI Translate",
        icon: TranslateIcon,
        active: pathname === "/translate",
        iconClass: "text-sky-500 dark:text-sky-400",
      },
      ...(isAuthenticated
        ? [
            {
              href: "/groups",
              label: "Reading Groups",
              icon: UsersIcon,
              active:
                pathname === "/groups" || pathname?.startsWith("/groups/"),
              iconClass: "text-emerald-500 dark:text-emerald-400",
            },
            {
              href: "/profile",
              label: "Profile & Favorites",
              icon: UserIcon,
              active: pathname === "/profile",
              iconClass: "text-purple-500 dark:text-purple-400",
            },
          ]
        : []),
    ],
    [pathname, isAuthenticated]
  );

  const bottomBarItems = useMemo(
    () => [
      ...navItems,
      ...(isOwner
        ? [
            {
              href: "/admin",
              label: "Admin Control Center",
              icon: SettingsIcon,
              active: pathname === "/admin",
              iconClass: "text-amber-500 dark:text-amber-400",
            },
          ]
        : []),
    ],
    [navItems, isOwner, pathname]
  );

  const activeBottomItem = useMemo(
    () => bottomBarItems.find((i) => i.active) || bottomBarItems[0],
    [bottomBarItems]
  );

  // 1. anime.js Entrance on Mount for Bottom App Bar
  useEffect(() => {
    if (!bottomBarRef.current) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    anime({
      targets: bottomBarRef.current,
      translateY: [24, 0],
      opacity: [0, 1],
      duration: 480,
      easing: "easeOutCubic",
    });
  }, []);

  // 2. anime.js Sliding Active Pill Indicator (Strictly centered X & Y inside bottomLinksWrapRef)
  useEffect(() => {
    const updateActiveIndicator = (animate = true) => {
      const wrapEl = bottomLinksWrapRef.current;
      const pillEl = bottomPillRef.current;
      const activeHref = activeBottomItem?.href;
      const targetLink = activeHref ? bottomItemRefs.current[activeHref] : null;

      if (!wrapEl || !pillEl || !targetLink) return;

      const wrapRect = wrapEl.getBoundingClientRect();
      const linkRect = targetLink.getBoundingClientRect();
      if (linkRect.width === 0) return;

      const pillWidth = 42;
      const pillHeight = 42;
      const nextX = Math.round(
        linkRect.left - wrapRect.left + (linkRect.width - pillWidth) / 2
      );
      const nextY = Math.round((wrapRect.height - pillHeight) / 2);

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!animate || prefersReduced) {
        anime.set(pillEl, {
          translateX: nextX,
          translateY: nextY,
          width: pillWidth,
          height: pillHeight,
          opacity: 1,
        });
      } else {
        anime({
          targets: pillEl,
          translateX: nextX,
          translateY: nextY,
          width: pillWidth,
          height: pillHeight,
          opacity: 1,
          duration: 460,
          easing: "easeOutElastic(1, .72)",
        });
      }

      Object.entries(bottomIconRefs.current).forEach(([href, iconEl]) => {
        if (!iconEl) return;
        const isCurrent = href === activeHref;
        if (prefersReduced) {
          anime.set(iconEl, { scale: isCurrent ? 1.1 : 1 });
        } else {
          anime({
            targets: iconEl,
            scale: isCurrent ? 1.12 : 1,
            duration: isCurrent ? 380 : 220,
            easing: isCurrent ? "easeOutElastic(1, .6)" : "easeOutQuad",
          });
        }
      });
    };

    const raf = requestAnimationFrame(() => updateActiveIndicator(true));
    const onResize = () => updateActiveIndicator(false);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [activeBottomItem, bottomBarItems.length]);

  const handleBottomTabPress = (href: string) => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const iconEl = bottomIconRefs.current[href];
    if (iconEl) {
      anime({
        targets: iconEl,
        scale: [
          { value: 0.82, duration: 75, easing: "easeInQuad" },
          { value: 1.2, duration: 150, easing: "easeOutQuad" },
          { value: 1.12, duration: 300, easing: "easeOutElastic(1, .5)" },
        ],
      });
    }
  };

  const handleDesktopIconHover = (href: string, entering: boolean) => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const el = desktopIconRefs.current[href];
    if (!el) return;
    anime({
      targets: el,
      scale: entering ? 1.15 : 1,
      rotate: entering ? [0, -8, 8, 0] : 0,
      duration: entering ? 400 : 220,
      easing: entering ? "easeOutElastic(1, .5)" : "easeOutQuad",
    });
  };

  if (pathname?.startsWith("/read/")) {
    return null;
  }

  return (
    <>
      {/* Desktop Floating Vertical Navigation Dock (Left side, Icon-only) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        style={{
          transform: "translate(0, -50%) translateZ(0)",
          backfaceVisibility: "hidden",
        }}
        className="fixed left-4 top-1/2 z-40 hidden flex-col items-center gap-2 rounded-3xl border border-slate-200/85 bg-white/90 px-2.5 py-3.5 shadow-2xl shadow-slate-950/10 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/90 dark:bg-slate-900/90 dark:shadow-black/40 md:flex"
      >
        <nav aria-label="Workspace Sections" className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                onMouseEnter={() => handleDesktopIconHover(item.href, true)}
                onMouseLeave={() => handleDesktopIconHover(item.href, false)}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  item.active
                    ? "bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/30"
                    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white"
                }`}
              >
                {item.active && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-2.5 h-5 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400"
                  />
                )}

                <div
                  ref={(el) => {
                    desktopIconRefs.current[item.href] = el;
                  }}
                  className="flex items-center justify-center"
                >
                  <Icon
                    size={20}
                    className={item.active ? "text-white" : item.iconClass}
                  />
                </div>

                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full ml-3.5 flex items-center whitespace-nowrap rounded-xl border border-slate-700/60 bg-slate-900/95 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-xl backdrop-blur-md transition-all duration-150 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 dark:border-slate-200/20 dark:bg-slate-100 dark:text-slate-900"
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {(folderLink || isOwner) && (
          <>
            <div className="h-px w-7 bg-slate-200/90 dark:bg-slate-800" />
            <div className="flex flex-col gap-1.5">
              {folderLink && isOwner && (
                <a
                  href={folderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Cloud Library Folder"
                  className="group relative flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 transition-all duration-200 hover:bg-slate-100/90 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-brand-300"
                >
                  <FolderIcon
                    size={20}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full ml-3.5 whitespace-nowrap rounded-xl border border-slate-700/60 bg-slate-900/95 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-xl backdrop-blur-md transition-all duration-150 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 dark:border-slate-200/20 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Cloud Drive Folder
                  </span>
                </a>
              )}

              {isOwner && (
                <Link
                  href="/admin"
                  aria-current={pathname === "/admin" ? "page" : undefined}
                  aria-label="Admin Control Center"
                  onMouseEnter={() => handleDesktopIconHover("/admin", true)}
                  onMouseLeave={() => handleDesktopIconHover("/admin", false)}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    pathname === "/admin"
                      ? "bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/30"
                      : "text-slate-600 hover:bg-slate-100/90 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-brand-300"
                  }`}
                >
                  {pathname === "/admin" && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-2.5 h-5 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400"
                    />
                  )}
                  <div
                    ref={(el) => {
                      desktopIconRefs.current["/admin"] = el;
                    }}
                    className="flex items-center justify-center"
                  >
                    <SettingsIcon size={20} />
                  </div>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full ml-3.5 whitespace-nowrap rounded-xl border border-slate-700/60 bg-slate-900/95 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-xl backdrop-blur-md transition-all duration-150 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 dark:border-slate-200/20 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Admin Control Center
                  </span>
                </Link>
              )}
            </div>
          </>
        )}

        <div className="h-px w-7 bg-slate-200/90 dark:bg-slate-800" />

        <div className="flex flex-col items-center gap-1.5">
          <ThemeToggle />
          <AboutButton />
        </div>
      </aside>

      {/* Clean Icon-Only Mobile Bottom App Bar — Perfectly Centered Sliding Pill */}
      <nav
        ref={bottomBarRef}
        aria-label="Mobile Bottom Navigation"
        style={{
          bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
        }}
        className="fixed left-4 right-4 sm:left-8 sm:right-8 z-40 mx-auto flex h-14 max-w-md items-center justify-between overflow-hidden rounded-full border border-slate-200/80 bg-white/95 px-2 shadow-[0_14px_36px_rgba(15,23,42,0.25)] backdrop-blur-2xl dark:border-slate-800/90 dark:bg-slate-950/95 dark:shadow-[0_14px_40px_rgba(0,0,0,0.75)] md:hidden"
      >
        {/* Navigation Links Container (Relative anchor for the sliding pill) */}
        <div
          ref={bottomLinksWrapRef}
          className="relative flex h-full flex-1 items-center justify-around"
        >
          {/* Single Clean anime.js Sliding Active Pill (Anchored at top: 0, left: 0) */}
          <div
            ref={bottomPillRef}
            aria-hidden="true"
            style={{ opacity: 0, left: 0, top: 0 }}
            className="pointer-events-none absolute rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 shadow-md shadow-brand-500/35"
          />

          {bottomBarItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  bottomItemRefs.current[item.href] = el;
                }}
                onClick={() => handleBottomTabPress(item.href)}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className="group relative z-10 flex h-11 flex-1 items-center justify-center rounded-2xl select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div
                  ref={(el) => {
                    bottomIconRefs.current[item.href] = el;
                  }}
                  className="flex items-center justify-center"
                >
                  <Icon
                    size={20}
                    className={`transition-colors duration-200 ${
                      item.active
                        ? "text-white"
                        : `${item.iconClass} opacity-80 group-hover:opacity-100`
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Clean Divider + Theme Toggle */}
        <div className="relative z-10 ml-1 flex h-8 items-center pl-2 border-l border-slate-200/80 dark:border-slate-800">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
