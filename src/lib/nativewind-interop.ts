import { cssInterop } from "nativewind";
// Agrega los componentes de terceros que necesiten className:

// import { SomeThirdPartyComponent } from 'some-library';
// cssInterop(SomeThirdPartyComponent, { className: 'style' });

// Solo debes agregar componentes de terceros que no tengan
// un wrapper dentro de src/components/ui.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

cssInterop(Image, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
