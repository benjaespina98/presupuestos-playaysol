"use client";

import dynamic from "next/dynamic";

const CercosCalculator = dynamic(() => import("./calculator"), {
  ssr: false,
});

export default function CercosPage() {
  return <CercosCalculator />;
}
