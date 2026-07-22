import "../../global.css";
import { Stack } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";

export default function RootLayout() {
  return (
    <>
      <Stack />
      {/* PortalHost Needs to be last child of your providers
      https://reactnativereusables.com/docs/installation/manual */}
      <PortalHost />
    </>
  );
}
