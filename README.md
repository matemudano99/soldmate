# 🍽️ Soldmate - ERP para Hostelería

![Soldmate Banner](https://img.shields.io/badge/Soldmate-ERP_Modular-4f6ef7?style=for-the-badge)

**Soldmate** es el aliado definitivo ("mate") de las ventas ("sold") y la gestión en la hostelería. Es un sistema de gestión empresarial integral, de bajo coste y alta accesibilidad diseñado específicamente para democratizar la tecnología en pequeños y medianos bares, cafeterías y restaurantes.

---

## 🎯 ¿Por qué Soldmate?
El sector hostelero requiere soluciones rápidas. Herramientas tradicionales como Odoo o Revo a menudo tienen costes de inversión enormes, requieren hardware específico o tienen curvas de aprendizaje muy pronunciadas. 

**Soldmate** resuelve esto ofreciendo:
- **Curva de aprendizaje nula**: Interfaz gráfica altamente funcional e intuitiva.
- **Bajo coste de entrada**: Despliegue en la nube accesible desde cualquier dispositivo, sin necesidad de hardware propietario.
- **Todo en uno**: Gestión integral desde una única plataforma.

## ✨ Características Principales

- 👥 **Gestión de Empleados y Accesos**: Sistema de roles (Propietario, Encargado, Empleado) para controlar quién ve qué, garantizando la privacidad del negocio.
- 📦 **Inventario y Proveedores**: Control de stock y gestión completa de tu red de proveedores.
- 🔧 **Gestión de Incidencias**: Reporte de averías con subida de fotos directamente desde el móvil.
- 📄 **Gestor Documental**: Repositorio centralizado para facturas, contratos y licencias, categorizado y seguro.
- 📈 **Panel Predictivo (Diferenciador)**: Integración con API meteorológica para cruzar el histórico de ventas con el clima, permitiendo ajustar compras de inventario y turnos de camareros basándose en el pronóstico del fin de semana.
- ⚡ **Feed de Actividad en Tiempo Real**: Un historial de auditoría unificado que registra quién crea, modifica o elimina cualquier elemento del sistema.

## 💶 Modelo de Negocio (Proyectado)
- **Plan Starter (29€ - 39€/mes)**: Gestión de inventario y empleados, panel de ventas básico. Ideal para cafeterías de barrio.
- **Plan Pro (59€ - 79€/mes)**: Dashboard predictivo con API del clima, múltiples usuarios simultáneos. Ideal para restaurantes medianos con terraza.

## 🛠️ Tecnologías
- **Frontend**: React, Next.js (App Router), Tailwind CSS, Zustand, React Query.
- **Backend**: Java 21, Spring Boot 3, Spring Security, JWT Auth.
- **Base de Datos y Almacenamiento**: PostgreSQL y Supabase Storage (BaaS).
- **Despliegue**: Docker Compose (Local), Vercel/Railway (Cloud).

## 🚀 Instalación y Despliegue Local

Soldmate está contenerizado con Docker para facilitar su despliegue local.

1. Clona el repositorio.
2. Configura las variables de entorno en el backend (`application.properties` o `.env`) con tus credenciales de Supabase.
3. Ejecuta el stack completo:
```bash
docker compose up -d --build
```
4. Accede al frontend en `http://localhost:23000` y a la API en `http://localhost:28080`.

---
*Diseñado y desarrollado por Mateo Mudano (2026).*
