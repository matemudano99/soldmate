"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#eef1f8] text-[#1e2040] px-6 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-6">Última actualización: 2026-05-08</p>

        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>Tratamos datos de cuenta y operación empresarial exclusivamente para prestar el servicio contratado.</p>
          <p>No vendemos datos personales a terceros. Solo compartimos información con proveedores técnicos indispensables (infraestructura/almacenamiento).</p>
          <p>Aplicamos medidas de seguridad razonables para proteger credenciales, sesiones y datos de negocio.</p>
          <p>Puedes solicitar exportación o eliminación de datos escribiendo al canal de soporte oficial.</p>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          <Link href="/login" className="text-[#4f6ef7] hover:underline">Volver al login</Link>
        </div>
      </div>
    </main>
  );
}

