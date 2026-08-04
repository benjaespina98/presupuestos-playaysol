"use client";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { buildCalculatorHtml } from "./markup";

export default function CercosCalculator() {
  return <Calculadora tipo="cercos" html={buildCalculatorHtml()} />;
}
