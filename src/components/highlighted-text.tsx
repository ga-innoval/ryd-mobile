import { cn } from "@/lib/utils";
import { Text } from "./ui/text";
import * as React from "react";

interface HighlightedTextProps extends Omit<
  React.ComponentProps<typeof Text>,
  "children"
> {
  text: string;
  match?: { index: number; length: number };
}

export function HighlightedText({
  match,
  text,
  ...props
}: HighlightedTextProps) {
  if (!match) {
    return <Text {...props}>{text}</Text>;
  }

  const before = text.slice(0, match.index);
  const highlighted = text.slice(match.index, match.index + match.length);
  const after = text.slice(match.index + match.length);

  return (
    <Text {...props}>
      {before}
      <Text {...props} className={cn("bg-yellow-300", props.className)}>
        {highlighted}
      </Text>
      {after}
    </Text>
  );
}
