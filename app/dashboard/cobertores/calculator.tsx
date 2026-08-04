"use client";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { buildCalculatorHtml } from "./markup";

export default function CobertoresCalculator() {
  return <Calculadora tipo="cobertores" html={buildCalculatorHtml()} />;
}
