import Link from "next/link";

const CATEGORIAS = [
  {
    tipo: "piscinas",
    nombre: "Piscinas",
    descripcion: "Calcular y guardar presupuesto de piscinas",
  },
  {
    tipo: "revestimientos",
    nombre: "Revestimientos",
    descripcion: "Calcular y guardar presupuesto de revestimientos",
  },
  {
    tipo: "cobertores",
    nombre: "Cobertores",
    descripcion: "Calcular y guardar presupuesto de cobertores",
  },
  {
    tipo: "cercos",
    nombre: "Cercos",
    descripcion: "Calcular y guardar presupuesto de cercos",
  },
  {
    tipo: "losetas",
    nombre: "Plano de pileta",
    descripcion: "Medidas, escalera, luces, solar y revestimiento — plano y presupuesto de borde perimetral",
  },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        Calculadoras de presupuesto
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIAS.map((c) => (
          <Link
            key={c.tipo}
            href={`/dashboard/${c.tipo}`}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-[#1B3A5C] hover:shadow-md"
          >
            <h2 className="text-lg font-medium text-gray-900">{c.nombre}</h2>
            <p className="mt-1 text-sm text-gray-500">{c.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
