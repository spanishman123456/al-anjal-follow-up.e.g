import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Accessible collapsible section with expand/collapse affordance.
 */
export function ExpandableSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
  contentClassName,
  testId,
  headerExtra,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md",
        className,
      )}
      data-testid={testId}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left",
          "transition-colors duration-200 hover:bg-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{title}</span>
            {headerExtra}
          </div>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("overflow-hidden", contentClassName)}>
        <div className="border-t border-border/60 px-4 pb-4 pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
