export type { UserRole } from "./api";

/** Roles con permiso de escritura habitual (no solo lectura). */
export function isReadOnlyRole(role: string | null): boolean {
  return role === "VIEWER";
}

export function canManageUsers(role: string | null): boolean {
  return role === "OWNER";
}

export function canEditFinance(role: string | null): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function canPostVacationRequest(role: string | null): boolean {
  return (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "SUPERVISOR" ||
    role === "EMPLOYEE"
  );
}

export function canUploadDocuments(role: string | null): boolean {
  return (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "SUPERVISOR" ||
    role === "EMPLOYEE"
  );
}

export function canPatchDocuments(role: string | null): boolean {
  return canUploadDocuments(role);
}

export function canDeleteDocuments(role: string | null): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "SUPERVISOR";
}

export function canManageDocumentCategories(role: string | null): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "SUPERVISOR";
}

/**
 * Enlaces del ERP lateral. VIEWER: sin finanzas (solo OWNER/MANAGER editan cierres;
 * ocultamos el módulo para simplificar lectura segura).
 */
export function isNavbarHrefVisible(href: string, role: string | null): boolean {
  if (!role) return false;
  if (href === "/finances" && role === "VIEWER") return false;
  return true;
}

export function roleDisplayLabel(role: string | null): string {
  switch (role) {
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
