"use client";

import dynamic from "next/dynamic";
import { CalculatorSkeleton } from "@/components/CalculatorSkeleton";

const RevestimientosCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
  loading: () => <CalculatorSkeleton />,
});

export default function RevestimientosPage() {
  return <RevestimientosCalculator />;
}
