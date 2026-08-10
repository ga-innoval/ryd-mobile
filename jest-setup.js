// setup for react-native-reanimated 4
// https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/#setup

require("react-native-reanimated").setUpTests();

jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
