"use client";

import dynamic from "next/dynamic";
import { CalculatorSkeleton } from "@/components/CalculatorSkeleton";

const LosetasCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});

export default function LosetasPage() {
  return <LosetasCalculator />;
}
