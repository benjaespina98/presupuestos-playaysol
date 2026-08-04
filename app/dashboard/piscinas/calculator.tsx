"use client";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { buildCalculatorHtml } from "./markup";

export default function PiscinasCalculator() {
  return <Calculadora tipo="piscinas" html={buildCalculatorHtml()} />;
}
