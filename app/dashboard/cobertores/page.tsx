"use client";

import dynamic from "next/dynamic";
import { CalculatorSkeleton } from "@/components/CalculatorSkeleton";

const CobertoresCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});

export default function CobertoresPage() {
  return <CobertoresCalculator />;
}
