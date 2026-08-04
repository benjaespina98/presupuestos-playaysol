"use client";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { buildCalculatorHtml } from "./markup";

export default function RevestimientosCalculator() {
  return <Calculadora tipo="revestimientos" html={buildCalculatorHtml()} />;
}
