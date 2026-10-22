// setup for react-native-reanimated 4
// https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/#setup

require("react-native-reanimated").setUpTests();

jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);

// `expo-notifications` es un módulo nativo: importarlo en Jest sin esto avisa
// del uso de push en Expo Go y no hay nada real detrás. Lo importa, por la
// cadena de los hooks de guardado, medio proyecto. Los tests que sí miran lo que
// se programa leen estos `jest.fn` con `jest.requireMock`.
jest.mock("expo-notifications", () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  getPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// El mock oficial de AsyncStorage. `usePlants` lee los campos del usuario del
// store de sesión, que persiste el perfil ahí, y con eso casi cualquier hook de
// plantaciones arrastra AsyncStorage a su test sin tocarlo.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
