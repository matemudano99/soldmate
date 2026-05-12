import type { ProductResponse } from "./api";

/** Clave de ordenación de categoría alineada con la UI ("Ninguna" si vacío). */
export function productCategorySortKey(p: ProductResponse): string {
  const c = p.category?.trim();
  return (c && c.length > 0 ? c : "Ninguna").toLowerCase();
}

export function compareProductsByCategoryThenName(a: ProductResponse, b: ProductResponse): number {
  const ca = productCategorySortKey(a);
  const cb = productCategorySortKey(b);
  if (ca !== cb) return ca.localeCompare(cb, "es");
  const nameCmp = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  if (nameCmp !== 0) return nameCmp;
  return a.id - b.id;
}
