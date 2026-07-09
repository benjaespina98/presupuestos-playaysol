"use client";

import dynamic from "next/dynamic";

const PiscinasCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
});

export default function PiscinasPage() {
  return <PiscinasCalculator />;
}
