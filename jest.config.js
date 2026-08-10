module.exports = {
  preset: "jest-expo",
  // Redirige ciertos paquetes a su build CommonJS ya compilado, ANTES de
  // que Jest intente resolver/transformar la versión ESM por defecto.
  // Útil cuando un paquete publica ESM roto/sin transpilar en su entrada
  // principal, pero SÍ trae un build alterno en CJS listo para usar.
  //
  // Si un paquete nuevo da "Cannot use import statement outside a module"
  // Y tiene un build CJS alterno en su carpeta (revisa node_modules/<paquete>/dist
  // o su package.json), agregalo aquí en vez de en transformIgnorePatterns
  //
  moduleNameMapper: {
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
  // Lista blanca de paquetes en node_modules que Jest SÍ debe transformar,
  // porque se distribuyen como ESM sin transpilar (rompen con
  // "Cannot use import statement outside a module" si no están aquí).
  //
  // - standard-navigation: dependencia interna de expo-router (SDK 57)
  // - lucide-react-native: dependencia para iconos de RNR
  // - @rn-primitives: dependencia para RNR
  //
  // Cuando veas "Cannot use import statement outside a module" con un paquete
  // nuevo, agrégalo aquí mismo, en el mismo grupo.
  //
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|standard-navigation|@rn-primitives)",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.js"],
};
