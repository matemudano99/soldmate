import type { UserListResponse } from "./api";

export function userDisplayName(u: Pick<UserListResponse, "fullName" | "firstName" | "lastName" | "email">): string {
  const full = u.fullName?.trim();
  if (full) return full;
  const parts = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return u.email?.trim() || "Usuario";
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.trim()[0] ?? "U").toUpperCase();
}
