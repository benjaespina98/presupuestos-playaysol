import Image from "next/image";

export function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <Image
      src="/logo-playa-sol.png"
      alt="Playa & Sol"
      width={1200}
      height={1200}
      priority
      className={`w-auto object-contain ${className}`}
    />
  );
}
