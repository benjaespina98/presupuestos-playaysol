"use client";

import dynamic from "next/dynamic";

const LosetasCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
});

export default function LosetasPage() {
  return <LosetasCalculator />;
}
