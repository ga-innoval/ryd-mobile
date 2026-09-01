import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { LogoutButton } from "@/domains/auth/components/logout-button";
import { useLogOut } from "@/domains/auth/hooks/use-logout";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { delay } from "@/lib/delay";
import { cn } from "@/lib/utils";
import type { TriggerRef } from "@rn-primitives/popover";
import { SettingsIcon } from "lucide-react-native";
import { useRef } from "react";
import { View } from "react-native";
import { app } from "@/lib/app-metadata";

const POPOVER_CLOSE_DELAY_MS = 300;

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const popoverTriggerRef = useRef<TriggerRef>(null);

  const onBeforeLogoutStarts = async () => {
    popoverTriggerRef.current?.close();
    await delay(POPOVER_CLOSE_DELAY_MS);
  };
  const { loggingOut, onLogOut } = useLogOut({ onBeforeLogoutStarts });

  return (
    <Popover>
      <PopoverTrigger asChild ref={popoverTriggerRef}>
        <Button variant="ghost" size="icon" className="size-8 rounded-full">
          <UserAvatar nickname={user?.username} initials={user?.initials} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" side="bottom" className="w-80 p-0">
        <View className="border-border gap-3 border-b p-3">
          <View className="flex-row items-center gap-3">
            <UserAvatar
              className="size-8"
              nickname={user?.username}
              initials={user?.initials}
            />
            <View className="flex-1">
              <Text className="font-medium leading-5">{user?.fullName}</Text>
              <Text className="text-muted-foreground text-sm font-normal leading-4 uppercase">
                @{user?.username}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-3 py-1">
            <Button
              variant="outline"
              onPress={() => {
                // TODO: Navigate to account settings screen
              }}
              disabled={true}
            >
              <Icon as={SettingsIcon} className="size-4" />
              <Text>Configuración</Text>
            </Button>
            <LogoutButton loading={loggingOut} onLogOut={onLogOut} />
          </View>
          <Text className="text-muted-foreground/70 text-sm self-center -my-1">
            {app.name} v{app.version}
          </Text>
        </View>
      </PopoverContent>
    </Popover>
  );
}

interface UserAvatarProps extends Omit<
  React.ComponentProps<typeof Avatar>,
  "alt"
> {
  nickname?: string;
  initials?: string;
}

function UserAvatar({
  className,
  nickname,
  initials,
  ...props
}: UserAvatarProps) {
  return (
    <Avatar
      alt={`${nickname ?? "unknown user"}'s avatar`}
      className={cn("size-8", className)}
      {...props}
    >
      <AvatarFallback>
        <Text>{initials ?? "UU"}</Text>
      </AvatarFallback>
    </Avatar>
  );
}
