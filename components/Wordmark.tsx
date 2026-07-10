import Image from "next/image";

export function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <Image
      src="/logo-playa-sol.png"
      alt="Playa & Sol"
      width={927}
      height={127}
      priority
      className={`w-auto object-contain ${className}`}
    />
  );
}
