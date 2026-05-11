"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#eef1f8] text-[#1e2040] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-gray-500 mb-6">Última actualización: 2026-05-08</p>

        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>Soldmate es una plataforma ERP para gestión operativa de hostelería. Al usar este servicio aceptas estos términos.</p>
          <p>Eres responsable de las credenciales de acceso de tu organización y del uso que hagan tus usuarios internos.</p>
          <p>Nos reservamos el derecho de suspender cuentas ante abuso, actividad maliciosa o incumplimiento legal.</p>
          <p>El servicio se ofrece “tal cual”, sujeto a mantenimiento, mejoras continuas y posibles ventanas de indisponibilidad técnica.</p>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          <Link href="/login" className="text-[#4f6ef7] hover:underline">Volver al login</Link>
        </div>
      </div>
    </main>
  );
}

