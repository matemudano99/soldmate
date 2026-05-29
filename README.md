Soldmate - ERP para Hostelería
<br><img width="100" height="100" alt="soldmate_nobg_ico" src="https://github.com/user-attachments/assets/0e02b6d5-dcdb-4f1e-a5f3-1b44def6addd" />


**Soldmate** es el aliado definitivo ("mate") de las ventas ("sold") y la gestión en la hostelería. Es un sistema de gestión empresarial integral, de bajo coste y alta accesibilidad diseñado específicamente para democratizar la tecnología en pequeños y medianos bares, cafeterías y restaurantes.

---

## 🎯 ¿Por qué Soldmate?
El sector hostelero requiere soluciones rápidas. Herramientas tradicionales como Odoo o Revo a menudo tienen costes de inversión enormes, requieren hardware específico o tienen curvas de aprendizaje muy pronunciadas. 

**Soldmate** resuelve esto ofreciendo:
- **Curva de aprendizaje nula**: Interfaz gráfica altamente funcional e intuitiva.
- **Bajo coste de entrada**: Despliegue en la nube accesible desde cualquier dispositivo, sin necesidad de hardware propietario.
- **Todo en uno**: Gestión integral desde una única plataforma.

## ✨ Características Principales y Módulos

- 🔐 **Arquitectura Multi-Tenant (Seguridad Aislada)**: El núcleo del sistema asegura matemáticamente que los datos de cada restaurante estén completamente aislados mediante el uso de JWT seguro y restricciones a nivel de base de datos (`companyId`). Los usuarios jamás envían este ID en las peticiones, lo extrae el backend desde la firma encriptada del token.
- 👥 **Gestión de Empleados y Accesos**: Sistema de Control de Acceso Basado en Roles (RBAC) con jerarquías (`OWNER`, `MANAGER`, `EMPLOYEE`) y rutas API protegidas.
- 📦 **Inventario y Proveedores**: Control de stock e IVA por producto, y gestión completa de la red de proveedores (con borrado lógico, *soft delete*, para no perder historial).
- 🔧 **Gestión de Incidencias**: Reporte de averías con ciclo de vida de estado (`OPEN`, `IN_PROGRESS`, `CLOSED`), prioridades y adjunto de imágenes directas desde el móvil.
- 📄 **Gestor Documental Inteligente**: Repositorio centralizado para facturas y licencias. Sube ficheros a Supabase Storage con autodetección de tipo MIME (clasifica automáticamente si es PDF, Excel, Imagen, etc.) y calcula el almacenamiento total de la empresa.
- 📅 **Agenda CRM**: Calendario integrado para gestionar turnos y recordatorios de la empresa.
- ⚡ **Feed de Actividad Universal**: Un *Audit Log* (Historial) transversal que intercepta de manera transparente cualquier creación, modificación o borrado de productos, documentos, incidencias o usuarios, mostrándolo en una bonita línea de tiempo.
- 📈 **Panel Predictivo (Diferenciador Post-MVP)**: Integración planificada con API meteorológica para cruzar el histórico de ventas con el clima, permitiendo ajustar compras de inventario y turnos de camareros basándose en el pronóstico del fin de semana.

## 💶 Modelo de Negocio (Proyectado)
- **Plan Starter (29€ - 39€/mes)**: Gestión de inventario y empleados, panel de ventas básico. Ideal para cafeterías de barrio.
- **Plan Pro (59€ - 79€/mes)**: Dashboard predictivo con API del clima, múltiples usuarios simultáneos. Ideal para restaurantes medianos con terraza.

## 🛠️ Tecnologías
- **Frontend**: React, Next.js (App Router), Tailwind CSS, Zustand, React Query.
- **App Android wrapper**: WebView nativo (sin Expo) en `soldmate-android-wrapper`.
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
