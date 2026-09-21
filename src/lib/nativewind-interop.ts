import { cssInterop } from "nativewind";
// Agrega los componentes de terceros que necesiten className:

// import { SomeThirdPartyComponent } from 'some-library';
// cssInterop(SomeThirdPartyComponent, { className: 'style' });

// Solo debes agregar componentes de terceros que no tengan
// un wrapper dentro de src/components/ui.

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

cssInterop(Image, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
// También `contentContainerClassName`: la pantalla de tratamiento lo usa, y sin
// mapearlo su padding se perdería en silencio.
cssInterop(KeyboardAwareScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
