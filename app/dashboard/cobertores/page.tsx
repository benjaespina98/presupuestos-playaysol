"use client";

import dynamic from "next/dynamic";

const CobertoresCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
});

export default function CobertoresPage() {
  return <CobertoresCalculator />;
}
