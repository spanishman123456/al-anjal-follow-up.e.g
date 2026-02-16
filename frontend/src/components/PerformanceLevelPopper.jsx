import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const levelColors = {
  on_level: "text-emerald-600",
  approach: "text-amber-600",
  below: "text-rose-600",
  no_data: "text-slate-500",
};

export function PerformanceLevelPopper({ level, label, className, "data-testid": dataTestId }) {
  const accentClass = levelColors[level];

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground",
            "hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            className
          )}
          data-testid={dataTestId}
          aria-label={label}
        >
          <PartyPopper className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" sideOffset={6} className="w-auto min-w-[140px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Performance level</p>
        <p className={cn("font-semibold mt-0.5", accentClass)}>{label}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
