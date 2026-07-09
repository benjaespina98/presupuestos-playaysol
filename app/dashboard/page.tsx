import Link from "next/link";

const CATEGORIAS = [
  { tipo: "piscinas", nombre: "Piscinas" },
  { tipo: "revestimientos", nombre: "Revestimientos" },
  { tipo: "cobertores", nombre: "Cobertores" },
  { tipo: "cercos", nombre: "Cercos" },
  { tipo: "losetas", nombre: "Losetas" },
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
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
          >
            <h2 className="text-lg font-medium text-gray-900">{c.nombre}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Calcular y guardar presupuesto de {c.nombre.toLowerCase()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
