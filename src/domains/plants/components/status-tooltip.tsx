import type { RefObject, ReactNode, Ref } from "react";
import type { TriggerRef } from "@rn-primitives/tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/text";

interface StatusTooltipProps {
  triggerRef: Ref<TriggerRef> | undefined;
  label: string;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export function StatusTooltip({
  triggerRef,
  label,
  children,
  onOpenChange,
}: StatusTooltipProps) {
  return (
    <Tooltip onOpenChange={onOpenChange}>
      <TooltipTrigger
        ref={triggerRef}
        className="flex-row items-center gap-1.5"
        hitSlop={8}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <Text className="text-primary-foreground/80 text-sm">{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}
