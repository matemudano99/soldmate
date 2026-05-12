// packages/app/hooks/useInventory.ts
//
// Hook personalizado que gestiona la carga de datos del inventario.
//
// ¿Por qué React Query?
// Gestiona automáticamente: carga inicial, estados de carga/error,
// caché, revalidación en background y reintento automático.
// Sin React Query tendrías que escribir todo eso manualmente con useState + useEffect.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { inventoryApi, type ProductResponse } from "../lib/api";
import { compareProductsByCategoryThenName } from "../lib/inventorySort";
import { useAuthStore } from "../lib/store";

export function useInventory() {
  const token = useAuthStore((state) => state.token);

  // useQuery: carga datos y los cachea.
  // queryKey: identifica este caché. Si cambia, vuelve a cargar.
  // queryFn: función que hace la petición real.
  const {
    data: products,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProductResponse[]>({
    queryKey: ["inventory"],
    queryFn: () => inventoryApi.getAll(token!),
    enabled: !!token, // solo ejecuta la query si hay token
    staleTime: 1000 * 60,        // datos frescos durante 1 minuto
    refetchOnWindowFocus: true,  // actualiza al volver a la app
  });

  const sortedProducts = useMemo(
    () => (products ? [...products].sort(compareProductsByCategoryThenName) : []),
    [products],
  );

  // Productos con stock bajo (para el panel de alertas del dashboard)
  const lowStockProducts = sortedProducts.filter((p) => p.lowStock);

  return {
    products: sortedProducts,
    lowStockProducts,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

// ─── Hook para actualizar stock ───────────────────────────────────────────────

export function useUpdateStock() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  // useMutation: para operaciones que modifican datos (POST, PATCH, DELETE)
  const mutation = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: number;
      quantity: number;
    }) => inventoryApi.updateStock(token!, productId, quantity),

    // onSuccess: después de actualizar, invalida el caché del inventario
    // para que React Query vuelva a cargar la lista actualizada
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  return {
    updateStock: mutation.mutate,
    isUpdating: mutation.isPending,
    updateError: mutation.error as Error | null,
  };
}
