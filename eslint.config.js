// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generado: los tipos de rutas de Expo y lo que salga del build.
    ignores: ["dist/*", ".expo/*", "expo-env.d.ts"],
  },
  {
    rules: {
      /**
       * **Toda la navegación pasa por `useAppRouter`**
       * (`src/lib/use-app-router.ts`), que lleva el candado antirrebote: sin
       * él, tocar tres veces seguidas una tarjeta apila tres pantallas
       * iguales, que es un bug que ya nos comimos.
       *
       * La regla está aquí y no solo en CLAUDE.md porque la convención se
       * rompe sola: el `useRouter` de Expo es lo primero que autocompleta
       * cualquiera que añada un botón.
       */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-router",
              importNames: ["useRouter", "router"],
              message:
                "Usa `useAppRouter` de @/lib/use-app-router: es el router con el candado que evita apilar pantallas al tocar varias veces.",
            },
          ],
        },
      ],
      /**
       * Reanimated escribe en `sharedValue.value` por diseño —es su API—, y
       * esta regla lo lee como mutar algo que React considera inmutable. En
       * este proyecto son todo falsos positivos.
       */
      "react-hooks/immutability": "off",
    },
  },
  {
    // El único que puede tomar el router de Expo: de ahí sale el de la app.
    files: ["src/lib/use-app-router.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Configuración de Jest, en JavaScript y fuera del entorno de la app.
    files: ["jest-setup.js", "jest.config.js"],
    languageOptions: {
      globals: { jest: "readonly" },
    },
  },
]);
