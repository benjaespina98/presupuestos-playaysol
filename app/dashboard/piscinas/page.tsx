"use client";

import dynamic from "next/dynamic";
import { CalculatorSkeleton } from "@/components/CalculatorSkeleton";

const PiscinasCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});

export default function PiscinasPage() {
  return <PiscinasCalculator />;
}
