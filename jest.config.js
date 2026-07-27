module.exports = {
  preset: "jest-expo",

  // Lista blanca de paquetes en node_modules que Jest SÍ debe transformar,
  // porque se distribuyen como ESM sin transpilar (rompen con
  // "Cannot use import statement outside a module" si no están aquí).
  //
  // - standard-navigation: dependencia interna de expo-router (SDK 57)
  //
  // Cuando veas "Cannot use import statement outside a module" con un paquete
  // nuevo, agrégalo aquí mismo, en el mismo grupo.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|standard-navigation)",
  ],
};
