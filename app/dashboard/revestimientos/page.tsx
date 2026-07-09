"use client";

import dynamic from "next/dynamic";

const RevestimientosCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
});

export default function RevestimientosPage() {
  return <RevestimientosCalculator />;
}
