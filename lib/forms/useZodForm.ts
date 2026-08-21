import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

/**
 * Punto único donde un formulario de la app conecta un schema de Zod con
 * React Hook Form. Existe para que esa conexión (`zodResolver`, el modo de
 * validación) se decida una sola vez acá y no una vez por pantalla.
 *
 * A propósito NO valida nada de negocio: el schema que se le pasa describe
 * FORMA de los datos (¿es un número?, ¿está el campo obligatorio?, ¿el string
 * mide lo que tiene que medir?), nunca una fórmula. El cálculo de precios
 * sigue siendo enteramente de lib/domain/precios — un MoneyField puede validar
 * "tiene que haber un número" pero jamás "el total tiene que dar tanto".
 *
 * `mode: "onTouched"`: no molesta con errores mientras la persona todavía no
 * pasó por el campo, pero en cuanto lo tocó una vez, revalida en cada cambio —
 * el equilibrio habitual entre "no interrumpir mientras se escribe" y "avisar
 * rápido si algo quedó mal".
 */
export function useZodForm<TSchema extends z.ZodType>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema> & FieldValues>, "resolver">
): UseFormReturn<z.infer<TSchema> & FieldValues> {
  return useForm<z.infer<TSchema> & FieldValues>({
    // El resolver de zod v4 tipa su `input` como `unknown`, que RHF no puede
    // conciliar con el FieldValues genérico sin ayuda: es un choque de tipos
    // entre dos librerías, no una imprecisión real en tiempo de ejecución
    // (zodResolver sigue devolviendo exactamente z.infer<TSchema>).
    resolver: zodResolver(schema as never) as unknown as Resolver<z.infer<TSchema> & FieldValues>,
    mode: "onTouched",
    ...options,
  });
}
