"use client";

import Link from "next/link";

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#eef1f8] text-[#1e2040] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Política de Cookies</h1>
        <p className="text-sm text-gray-500 mb-6">Última actualización: 2026-05-08</p>

        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>Soldmate utiliza cookies técnicas para autenticación de sesión y funcionamiento básico de la aplicación.</p>
          <p>Las cookies de sesión permiten validar acceso y proteger áreas privadas del ERP.</p>
          <p>Actualmente no usamos cookies publicitarias de terceros dentro de la aplicación.</p>
          <p>Al continuar usando Soldmate, aceptas el uso de cookies técnicas necesarias para el servicio.</p>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          <Link href="/login" className="text-[#4f6ef7] hover:underline">Volver al login</Link>
        </div>
      </div>
    </main>
  );
}

