export type { AppRole, UserRole } from "./api";

export function isDevRole(role: string | null): boolean {
  return role === "DEV";
}

export function canAccessDevConsole(role: string | null): boolean {
  return isDevRole(role);
}

/** Equivalente a OWNER en el ERP (incluye operadores DEV en el tenant activo). */
export function isOwnerOrDev(role: string | null): boolean {
  return role === "OWNER" || isDevRole(role);
}

/** DEV tiene permisos de escritura en todos los módulos del tenant. */
export function hasTenantWriteAccess(role: string | null): boolean {
  if (!role) return false;
  if (isDevRole(role)) return true;
  return role !== "VIEWER";
}

export function canAccessBusinessSettings(role: string | null): boolean {
  return isOwnerOrDev(role);
}

export function isReadOnlyRole(role: string | null): boolean {
  if (isDevRole(role)) return false;
  return role === "VIEWER";
}

export function canManageUsers(role: string | null): boolean {
  return isOwnerOrDev(role);
}

export function canEditFinance(role: string | null): boolean {
  return isOwnerOrDev(role) || role === "MANAGER";
}

export function canManageInventory(role: string | null): boolean {
  if (isDevRole(role)) return true;
  return role === "OWNER" || role === "MANAGER" || role === "SUPERVISOR";
}

export function canCreateIncident(role: string | null): boolean {
  return hasTenantWriteAccess(role);
}

export function canViewAllVacations(role: string | null): boolean {
  return isOwnerOrDev(role) || role === "MANAGER";
}

export function canPostVacationRequest(role: string | null): boolean {
  return hasTenantWriteAccess(role);
}

export function canUploadDocuments(role: string | null): boolean {
  return hasTenantWriteAccess(role);
}

export function canPatchDocuments(role: string | null): boolean {
  return canUploadDocuments(role);
}

export function canDeleteDocuments(role: string | null): boolean {
  if (isDevRole(role)) return true;
  return role === "OWNER" || role === "MANAGER" || role === "SUPERVISOR";
}

export function canManageDocumentCategories(role: string | null): boolean {
  if (isDevRole(role)) return true;
  return role === "OWNER" || role === "MANAGER" || role === "SUPERVISOR";
}

export function canManageSuppliers(role: string | null): boolean {
  return isOwnerOrDev(role);
}

/**
 * Enlaces del ERP lateral. VIEWER: sin finanzas (solo OWNER/MANAGER editan cierres;
 * ocultamos el módulo para simplificar lectura segura).
 */
export function isNavbarHrefVisible(href: string, role: string | null): boolean {
  if (!role) return false;
  if (href === "/dev-console") return canAccessDevConsole(role);
  if (href === "/finances" && role === "VIEWER") return false;
  return true;
}

export function roleDisplayLabel(role: string | null): string {
  switch (role) {
    case "DEV":
      return "Desarrollador";
    case "OWNER":
      return "Propietario";
    case "MANAGER":
      return "Gerente";
    case "SUPERVISOR":
      return "Supervisor";
    case "EMPLOYEE":
      return "Empleado";
    case "VIEWER":
      return "Solo lectura";
    default:
      return "Usuario";
  }
}
