<!-- docs/dependency-overrides.md -->

# Overrides de dependencias

Registro de por qué existen los `overrides` en `package.json`. Revisar en cada
actualización de Expo SDK — si el bug de origen ya se corrigió upstream, quitar
el override correspondiente.

## react-dom → 19.2.3

**Por qué:** `expo-router@57.0.8` trae `react-dom@19.2.8` como dependencia
directa (usado en su soporte web de Tabs/Dialog vía `vaul`/`@radix-ui`), pero
el resto del SDK 57 fija `react@19.2.3`. Sin el override, `npm install` falla
con ERESOLVE.

**Issue relacionado:** https://github.com/expo/expo/issues/47435

**Cuándo quitarlo:** cuando Expo publique un patch de SDK 57 (o el SDK 58)
donde `react`/`react-dom` coincidan en versión de forma nativa. Verificar con
`npm ls react react-dom` — si ya no aparece `invalid`, es seguro remover.
