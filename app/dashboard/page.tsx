import Link from "next/link";

const CATEGORIAS = [
  {
    tipo: "piscinas",
    nombre: "Piscinas",
    icon: (
      <path d="M2 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M4 12V6a2 2 0 0 1 2-2h6l6 6v2" />
    ),
  },
  {
    tipo: "revestimientos",
    nombre: "Revestimientos",
    icon: (
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    ),
  },
  {
    tipo: "cobertores",
    nombre: "Cobertores",
    icon: (
      <path d="M3 12a9 9 0 0 1 18 0M3 12h18M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" />
    ),
  },
  {
    tipo: "cercos",
    nombre: "Cercos",
    icon: (
      <path d="M4 21V9l3-3 3 3v12M11 21V9l3-3 3 3v12M4 15h6M11 15h6" />
    ),
  },
  {
    tipo: "losetas",
    nombre: "Plano de Piscina",
    icon: (
      <path d="M3 3h18v18H3zM3 8h4M3 13h4M17 8h4M17 13h4M8 3v4M13 3v4M8 17v4M13 17v4" />
    ),
  },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        Presupuestos
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIAS.map((c) => (
          <Link
            key={c.tipo}
            href={`/dashboard/${c.tipo}`}
            className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[#1B3A5C] hover:shadow-md"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 shrink-0 text-[#1B3A5C]/70 transition group-hover:text-[#1B3A5C]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {c.icon}
            </svg>
            <h2 className="text-xl font-bold text-gray-900">{c.nombre}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
