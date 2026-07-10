// Recreación tipográfica del isologo "PLAYA & SOL" (navy + O dorada + ola navy debajo)
// que mostró el usuario. No pude extraer el archivo pegado en el chat (mismo límite que
// con el logo de losetas), así que en vez de rasterizar una imagen se arma con texto real
// (nítido a cualquier tamaño, sin riesgo de corrupción) + un trazo de ola en SVG.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[2px] font-normal uppercase tracking-[0.08em] text-[#1B3A5C] ${className}`}>
      <span>Playa &amp; S</span>
      <span className="relative inline-flex flex-col items-center">
        <span className="text-[#F0B400]">O</span>
        <svg
          viewBox="0 0 24 6"
          className="absolute -bottom-1.5 h-1.5 w-full text-[#1B3A5C]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 3c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0" />
        </svg>
      </span>
      <span>L</span>
    </span>
  );
}
