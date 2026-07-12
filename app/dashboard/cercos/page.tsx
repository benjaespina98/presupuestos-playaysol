"use client";

import dynamic from "next/dynamic";
import { CalculatorSkeleton } from "@/components/CalculatorSkeleton";

const CercosCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});

export default function CercosPage() {
  return <CercosCalculator />;
}
