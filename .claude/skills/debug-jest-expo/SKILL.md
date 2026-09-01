---
name: debug-jest-expo
description: Diagnostica fallos de Jest, Expo SDK 57 y NativeWind en este proyecto — "Cannot use import statement outside a module", módulos nativos sin mock, clases de Tailwind que no aplican, FlashList v2 en tests, reanimated 4 + worklets. Úsalo cuando un test falle por configuración (no por lógica) o cuando un estilo no se aplique sin dar error.
---

# Debug de Jest / Expo / NativeWind

Primero decide de qué tipo es el fallo. La mayoría del tiempo perdido en este
repo viene de confundir un problema de configuración con uno de lógica.

## 1. `Cannot use import statement outside a module`

El paquete se publica como ESM sin transpilar y Jest no lo transforma.
**Hay dos arreglos y elegir el equivocado hace perder el doble de tiempo:**

Revisa si el paquete trae un build CJS alterno:

```bash
ls node_modules/<paquete>/dist/
node -p "JSON.stringify(require('./node_modules/<paquete>/package.json').exports, null, 2)"
```

- **Sí trae CJS** → `moduleNameMapper` en `jest.config.js`, apuntando al build
  CJS. Es más barato: Jest no transforma nada, solo redirige la resolución.
  Precedente: `lucide-react-native` → `dist/cjs/lucide-react-native.js`.
- **No trae CJS** → agrégalo a la lista blanca de `transformIgnorePatterns`,
  en el mismo grupo que los demás. Precedentes: `standard-navigation`
  (dependencia interna de expo-router en SDK 57), `@rn-primitives`.

`jest.config.js` ya documenta ambos casos inline. Al agregar uno nuevo,
extiende ese comentario con el porqué — es documentación que sí se lee.

## 2. Un estilo de NativeWind no se aplica (y no hay error)

**NativeWind falla en silencio con clases inexistentes**: no hay error de
compilación, ni warning, ni nada en consola. El estilo simplemente no ocurre.

```bash
# ¿la clase existe realmente?
grep -n "pulse-deep\|<tu-clase>" tailwind.config.js
# todas las animaciones custom en uso vs. las definidas
grep -rn "animate-" src/ | grep -v node_modules
```

Precedente real: `animate-pulse-soft` se usó durante semanas en el skeleton;
la animación definida se llama `pulse-deep`. El skeleton nunca animó y nada
lo delató. Ante cualquier clase custom, verifica antes de asumir.

Otro caso frecuente: en `ScrollView`, `className` estiliza el ScrollView y
`contentContainerClassName` el contenido interno. Confundirlos rompe layouts
flex con hermanos sin dar error.

## 3. Módulos nativos en tests

`jest-setup.js` ya cubre reanimated 4 (`setUpTests()`) y mockea
`react-native-worklets`. Si un módulo nativo nuevo revienta:

- ¿El paquete trae su propio `jestSetup`? Úsalo antes de escribir un mock a
  mano (ej. `@shopify/flash-list/jestSetup` sí existe en v2.0.2).
- Si el módulo es del dominio (no de una librería), prefiere un `__mocks__/`
  junto al archivo real, como `domains/auth/lib/__mocks__/storage.ts`, y
  actívalo con `jest.mock("../../lib/storage")`.

## 4. FlashList en tests

- El `jestSetup` oficial **existe** en v2.0.2: mapea `FlashList → RecyclerView`
  y mockea `measureLayout` con tamaños fijos (400×900).
- **`estimatedListSize` no existe en FlashList v2.** Cualquier receta que la
  mencione es de v1 y no se puede aplicar aquí.
- Nadie ha logrado (ni intentado) testear el componente `List` todavía;
  `list.test.tsx` prueba `PlantCard` directo. Si lo intentas y funciona,
  documenta cómo en `CLAUDE.md`.

## 5. Antes de dar algo por resuelto

Reproduce exactamente lo que corre el CI (`.github/workflows/test.yml`):

```bash
npx jest --ci --coverage
```

```bash
npx tsc --noEmit
```

Un test verde con `tsc` rojo igual rompe el pipeline. Si `tsc` se queja de
tipos de rutas de Expo Router, el CI regenera los tipos antes con
`npx expo customize tsconfig.json`.

## Regla general

Ante una API que pueda haber cambiado (Reanimated, FlashList, Expo SDK), lee
los typings instalados en `node_modules` antes de asumir el comportamiento:

```bash
grep -rn "<símbolo>" node_modules/<paquete>/lib/typescript/ | head
```

Es más rápido y más confiable que recordar cómo funcionaba en la versión
anterior. Así se descubrió que `useAnimatedKeyboard` está deprecado y que
`estimatedListSize` desapareció en FlashList v2.
