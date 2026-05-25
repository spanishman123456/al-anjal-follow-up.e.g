import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavGroupActive, isNavItemActive } from "@/lib/navigationConfig";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function navTabClass(active) {
  return cn(
    "top-nav-tab inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
    active ? "top-nav-tab--active" : "top-nav-tab--idle",
  );
}

function NavDropdown({ group, pathname, isRTL, prefetchRoute }) {
  const active = isNavGroupActive(pathname, group);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={navTabClass(active)}
          data-testid={group.testId}
          aria-label={group.label}
        >
          <span>{group.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 opacity-80", isRTL && "rotate-180")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? "end" : "start"}
        className="top-nav-dropdown min-w-[220px] border-white/10 bg-[#161C31] p-1.5 text-white shadow-xl"
      >
        {group.items.map((item) => (
          <DropdownMenuItem key={item.testId || item.to} asChild className="p-0 focus:bg-transparent">
            <NavLink
              to={item.to}
              data-testid={item.testId}
              onMouseEnter={() => prefetchRoute(item.to)}
              onFocus={() => prefetchRoute(item.to)}
              onTouchStart={() => prefetchRoute(item.to)}
              className={({ isActive }) =>
                cn(
                  "top-nav-dropdown-item flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors",
                  isActive || isNavItemActive(pathname, item.to)
                    ? "bg-gradient-to-r from-[#8B2BEC] to-[#E91E8F] text-white"
                    : "text-[#E8ECF4] hover:bg-white/10 hover:text-white",
                )
              }
            >
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavSheet({ groups, pathname, isRTL, t, prefetchRoute }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="top-nav-menu-btn shrink-0 rounded-full border border-white/20 bg-white/5 text-white hover:bg-white/15 lg:hidden"
          data-testid="top-nav-mobile-menu"
          aria-label={t("nav_menu")}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRTL ? "right" : "left"}
        className="top-nav-sheet w-[min(100vw-2rem,320px)] border-white/10 bg-[#0D1222] text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-start text-base font-bold text-white">{t("nav_menu")}</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-6" data-testid="top-nav-mobile">
          {groups.map((group) => {
            if (group.type === "link") {
              const active = isNavGroupActive(pathname, group);
              return (
                <NavLink
                  key={group.id}
                  to={group.to}
                  data-testid={group.testId}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-semibold",
                    active
                      ? "bg-gradient-to-r from-[#8B2BEC] to-[#E91E8F] text-white"
                      : "bg-white/5 text-[#E8ECF4] hover:bg-white/10",
                  )}
                >
                  {group.label}
                </NavLink>
              );
            }
            return (
              <div key={group.id} className="space-y-2">
                <p className="px-1 text-xs font-bold uppercase tracking-wider text-[#7ED7F7]">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.testId || item.to}
                      to={item.to}
                      data-testid={item.testId}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "rounded-lg px-4 py-2.5 text-sm font-semibold",
                          isActive || isNavItemActive(pathname, item.to)
                            ? "bg-gradient-to-r from-[#8B2BEC]/90 to-[#E91E8F]/90 text-white"
                            : "text-[#C5CDDC] hover:bg-white/8 hover:text-white",
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function TopNavigation({ groups, isRTL, t, prefetchRoute }) {
  const { pathname } = useLocation();

  return (
    <nav
      className="top-nav-bar relative z-10 border-t border-white/10 px-4 py-3 sm:px-6"
      data-testid="top-navigation"
      aria-label="Main navigation"
    >
      <div className="relative mx-auto flex w-full max-w-[1600px] items-center justify-center">
        <div className="absolute start-0 top-1/2 z-10 -translate-y-1/2 lg:hidden">
          <MobileNavSheet
            groups={groups}
            pathname={pathname}
            isRTL={isRTL}
            t={t}
            prefetchRoute={prefetchRoute}
          />
        </div>
        <div
          className="hidden flex-wrap items-center justify-center gap-2 lg:flex"
          data-testid="top-nav-desktop"
        >
          {groups.map((group) => {
            if (group.type === "link") {
              const active = isNavGroupActive(pathname, group);
              return (
                <NavLink
                  key={group.id}
                  to={group.to}
                  end={group.to === "/"}
                  data-testid={group.testId}
                  onMouseEnter={() => prefetchRoute(group.to)}
                  onFocus={() => prefetchRoute(group.to)}
                  onTouchStart={() => prefetchRoute(group.to)}
                  className={navTabClass(active)}
                >
                  {group.label}
                </NavLink>
              );
            }
            return (
              <NavDropdown
                key={group.id}
                group={group}
                pathname={pathname}
                isRTL={isRTL}
                prefetchRoute={prefetchRoute}
              />
            );
          })}
        </div>
      </div>
    </nav>
  );
}
