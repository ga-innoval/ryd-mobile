import { useState } from "react";
import { View } from "react-native";
import {
  ArrowRightIcon,
  GrapeIcon,
  TriangleAlertIcon,
} from "lucide-react-native";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import { DateField } from "@/components/ui/date-field";
import { Icon } from "@/components/ui/icon";
import { OptionPicker } from "@/components/ui/option-picker";
import { PercentSlider } from "@/components/ui/percent-slider";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/ui/star-rating";
import { Text } from "@/components/ui/text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatISODate } from "@/lib/dates";
import {
  buildFrutaDefaults,
  evaluacionAntesDelEmpaque,
  fechaEsperada,
  frutaAnswered,
  FRUTA_TOTAL_PREGUNTAS,
  NIVEL_FEMENINO,
  NIVEL_FEMENINO_PLURAL,
  NIVEL_MASCULINO,
  periodoDias,
  type FrutaValues,
} from "../lib/postcosecha-fruta";

/**
 * TODO(escala): el diseño deja los extremos de las tres escalas como
 * `[MÍNIMO]` y `[MÁXIMO]` — el negocio todavía no ha dicho qué significan un 1
 * y un 5 en Tallo, Calidad de consumo y Sabor. Se enseñan así a propósito, para
 * que se vea que falta, en vez de inventar «Malo/Bueno» y que nadie lo revise.
 */
const ESCALA_MIN = "[MÍNIMO]";
const ESCALA_MAX = "[MÁXIMO]";

/** Lo que la cabecera de la sección enseña en su hueco de resumen. */
export function PostcosechaFrutaHeaderSummary({
  values,
}: {
  values: FrutaValues;
}) {
  return (
    <Text variant="muted">
      {`${frutaAnswered(values)} de ${FRUTA_TOTAL_PREGUNTAS} preguntas`}
    </Text>
  );
}

/**
 * La sección «Evaluación fruta» de post-cosecha: once preguntas y cuatro formas
 * de capturar —fecha, píldoras, estrellas y porcentaje—.
 *
 * **Todavía no persiste.** El estado vive aquí, en memoria, y se pierde al
 * salir. Post-cosecha no tiene tabla de respuestas ni autoguardado, y montarlos
 * era un paso aparte; las fotografías sí persisten porque se guardan solas al
 * capturarse. Cuando llegue la persistencia, este `useState` pasa a ser el
 * `defaultValues` de un `react-hook-form` y lo demás se queda igual.
 */
export function PostcosechaFrutaForm({
  evalId,
  values,
  onChange,
}: {
  /** Cuál de las cuatro: de ahí salen los días que se suman al empaque. */
  evalId: string;
  values: FrutaValues;
  onChange: (values: FrutaValues) => void;
}) {
  const set = <K extends keyof FrutaValues>(key: K, value: FrutaValues[K]) =>
    onChange({ ...values, [key]: value });

  const dias = periodoDias(evalId);
  const esperada = fechaEsperada(values.fecha_empaque, dias);
  const sugerir = !values.fecha_evaluacion && !!esperada;
  const fechaImposible = evaluacionAntesDelEmpaque(
    values.fecha_empaque,
    values.fecha_evaluacion,
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-start gap-4">
        <View className="flex-1 gap-2">
          <Text variant="muted">Fecha de empaque</Text>
          <DateField
            value={values.fecha_empaque}
            onChange={(value) => set("fecha_empaque", value)}
            accessibilityLabel="Fecha de empaque"
          />
          <Text className="text-[13px] text-muted-foreground">
            La fecha que trae la caja.
          </Text>
        </View>

        <View className="flex-1 gap-2">
          <Text variant="muted">Fecha de evaluación</Text>
          <DateField
            value={values.fecha_evaluacion}
            onChange={(value) => set("fecha_evaluacion", value)}
            accessibilityLabel="Fecha de evaluación"
          />

          {/* La esperada se ofrece, no se impone: el evaluador puede abrir la
              caja un día después y la fecha real es la que vale. */}
          {sugerir && (
            <PressableScale
              onPress={() => set("fecha_evaluacion", esperada)}
              role="button"
              className="flex-row items-center gap-1.5 self-start rounded-full border border-dashed border-primary/40 px-2.5 py-1"
            >
              <Icon as={ArrowRightIcon} size={12} className="text-primary" />
              <Text className="text-[13px] font-semibold text-primary">
                {`Usar ${formatISODate(esperada)}`}
              </Text>
            </PressableScale>
          )}

          {!sugerir && (
            <Text className="text-[13px] text-muted-foreground">
              {values.fecha_evaluacion && dias !== null
                ? `${dias} días después del empaque.`
                : "Se sugiere al capturar el empaque."}
            </Text>
          )}
        </View>
      </View>

      {/* Imposible, no raro: la caja no se puede evaluar antes de existir. */}
      {fechaImposible && (
        <Alert icon={TriangleAlertIcon} variant="destructive">
          <AlertDescription>
            La fecha de evaluación no puede ser anterior a la de empaque.
          </AlertDescription>
        </Alert>
      )}

      <Separator />
      <OptionPicker
        label="Acidez"
        options={NIVEL_FEMENINO}
        value={values.acidez}
        onChange={(value) => set("acidez", value)}
      />

      <Separator />
      <StarRating
        label="Tallo"
        value={values.tallo}
        onChange={(value) => set("tallo", value)}
        minLabel={ESCALA_MIN}
        maxLabel={ESCALA_MAX}
      />

      <Separator />
      <PercentSlider
        label="Bayas reventadas"
        value={values.bayas_reventadas}
        onChange={(value) => set("bayas_reventadas", value)}
        step={0.5}
      />

      <Separator />
      <PercentSlider
        label="Desgrane"
        value={values.desgrane}
        onChange={(value) => set("desgrane", value)}
        step={0.5}
      />

      <Separator />
      <OptionPicker
        label="Daño por azufre"
        options={NIVEL_MASCULINO}
        value={values.dano_azufre}
        onChange={(value) => set("dano_azufre", value)}
      />

      <Separator />
      <OptionPicker
        label="Manchas cafés"
        options={NIVEL_FEMENINO_PLURAL}
        value={values.manchas_cafes}
        onChange={(value) => set("manchas_cafes", value)}
      />

      <Separator />
      <StarRating
        label="Calidad de consumo"
        value={values.calidad_consumo}
        onChange={(value) => set("calidad_consumo", value)}
        minLabel={ESCALA_MIN}
        maxLabel={ESCALA_MAX}
      />

      <Separator />
      <StarRating
        label="Sabor"
        value={values.sabor}
        onChange={(value) => set("sabor", value)}
        minLabel={ESCALA_MIN}
        maxLabel={ESCALA_MAX}
      />

      <Separator />
      {/* Entera, no de medio en medio: es el único porcentaje sin decimales. */}
      <PercentSlider
        label="Deshidratación"
        value={values.deshidratacion}
        onChange={(value) => set("deshidratacion", value)}
        step={1}
      />
    </View>
  );
}

/**
 * La sección entera —cabecera plegable y cuerpo—, con su estado.
 *
 * Junta las dos porque la cabecera enseña el conteo de contestadas y el cuerpo
 * es quien lo cambia: separarlas obligaría a subir el estado a la pantalla, que
 * no tiene nada que hacer con él.
 *
 * Quien la monta le pone `key={evalId}`: **lo capturado es de esta evaluación**,
 * no de la siguiente, y al saltar entre las cuatro tiene que empezar de cero.
 * Hoy además se pierde, porque esto todavía no persiste.
 */
export function PostcosechaFrutaSection({ evalId }: { evalId: string }) {
  const [values, setValues] = useState<FrutaValues>(buildFrutaDefaults);
  const [open, setOpen] = useState(true);

  return (
    <>
      <View className="bg-background pt-4">
        <CollapsibleHeader
          icon={GrapeIcon}
          title="Evaluación fruta"
          description="Estado de la fruta al abrir la caja, con las fechas de empaque y de evaluación."
          summary={<PostcosechaFrutaHeaderSummary values={values} />}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      </View>
      <CollapsibleBody open={open}>
        <PostcosechaFrutaForm
          evalId={evalId}
          values={values}
          onChange={setValues}
        />
      </CollapsibleBody>
    </>
  );
}
