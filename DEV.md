# 💻 Soldmate - Guía de Desarrollo (DEV.md)

Este documento sirve como contexto técnico y arquitectura de referencia para desarrolladores e Inteligencias Artificiales que trabajen en el código de **Soldmate**.

## 🏗️ Arquitectura General

Soldmate sigue una arquitectura monolítica modular en el backend y un frontend desacoplado (SPA/SSR). 
El sistema es **Multi-Tenant**: toda la información pertenece a una empresa (`Company`). Las consultas en base de datos *siempre* deben filtrar o estar aisladas por `companyId`.

### Stack Técnico
- **Frontend**: `apps/next` (Next.js 14 App Router), TypeScript, TailwindCSS, Lucide React (iconos), Zustand (estado global de Auth y Navbar), TanStack Query v5 (caché y fetching).
- **Backend**: Spring Boot 3.4.1, Java 21, Hibernate/JPA. 
- **Infraestructura**: Docker Compose con `postgres` nativo (para desarrollo local aislado) y Supabase (PostgreSQL remoto + Storage + Auth potencial).

---

## 🔒 Autenticación y Seguridad

1. **Flujo Stateless (JWT)**:
   - El login (`/api/v1/auth/login`) genera un JWT firmado (`soldmate.jwt.secret`) válido por 24 horas.
   - El frontend envía el token en la cabecera `Authorization: Bearer <token>`.
   - `JwtFilter.java` en Spring Security intercepta, valida y almacena los datos en el `SecurityContext`.

2. **Resolución del CompanyId**:
   - Para garantizar el aislamiento de datos (Multi-Tenant), cada controlador usa un método helper (ej. `jwtUtil.extractCompanyId()`) para saber a qué empresa pertenece el usuario que realiza la petición. Un empleado de la empresa A jamás puede ver datos de la empresa B.

---

## 🚀 Módulos Core

### 1. Sistema de Actividad (Activity Log)
- **Concepto**: Un log de auditoría inmutable que rastrea toda la actividad (Creación, Modificación, Eliminación) de cualquier módulo.
- **Implementación**: `ActivityLogger.java` provee el método `.log(companyId, userEmail, entityType, action, title)`.
- **Integración**: Se inyecta en los servicios/controladores de Incidentes, Documentos, Usuarios, Proveedores y Agenda.
- **Frontend**: La página `/activity` procesa de forma genérica los `actionVerbs` y mapea los iconos dinámicamente según `type` (INCIDENT, DOCUMENT, SUPPLIER, USER, TASK).

### 2. Gestión Documental (`documents` y `incidents`)
- **Almacenamiento**: Utiliza **Supabase Storage**. El backend (Java 11+ `HttpClient`) se encarga de empaquetar el fichero y subirlo a un bucket configurado (`soldmate.supabase.bucket`, que por defecto es `incidents`).
- **Seguridad de Archivos**: Los archivos se renombran con `UUID` y se agrupan en carpetas con el `{companyId}/`.
- **Detección MIME**: `DocumentService.java` es capaz de detectar inteligentemente la extensión y clasificar archivos por tipo (PDF, XLSX, IMG, etc.).

### 3. Empleados y Proveedores (`auth` e `inventory`)
- Controlador `UserController.java`: Administra roles (`OWNER`, `MANAGER`, `EMPLOYEE`).
- Controlador `SupplierController.java`: Mantiene el registro de proveedores con estado de activación (Soft Delete con `active=false`).

---

## 🔧 Buenas Prácticas y Convenciones

1. **Seguridad y `@Transactional`**:
   - Siempre usar `@Transactional(readOnly = true)` en lecturas si hay relaciones anidadas o colecciones Lazy para evitar `LazyInitializationException`.
   - Modificar datos requiere roles específicos (`@PreAuthorize("hasRole('OWNER')")` en métodos destructivos o de creación crítica).

2. **Frontend UI**:
   - Uso de componentes compartidos en `packages/app/ui` y `packages/app/components`.
   - Estética industrial-premium (`bg-[#eef1f8]`, textos `#1e2040`, acentos `#4f6ef7`), bordes redondeados y micro-animaciones (hovers fluidos).
   - Para iconos genéricos, usar siempre la librería `lucide-react`.
   - Mantener el Sidebar (`WebErpNavbar`) con estado persistente vía `localStorage`.

3. **Docker**:
   - Frontend (`soldmate-frontend`) compila para producción (`npm run build` y `npm start`) en un contenedor Node ligero.
   - Backend (`soldmate-backend`) usa Maven multi-stage para construir un `.jar` y ejecutarlo en Alpine Java 21.

## 🔮 Roadmap / Funciones Pendientes (MVP -> Total)
- **Cierres de caja y rentabilidad**: Automatización contable.
- **Predicción Meteorológica**: Integrar la API de OpenWeatherMap en el dashboard y cruzar con ventas/agenda de personal.
- **Notificaciones Tiempo Real**: Añadir WebSockets o Supabase Realtime para notificar al equipo sobre incidencias urgentes.
