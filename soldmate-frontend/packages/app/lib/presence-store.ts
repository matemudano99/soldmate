import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** TTL local tras heartbeat OK (ms). */
const LOCAL_ONLINE_TTL_MS = 6 * 60 * 1000;

type PresenceState = {
  onlineUntilByUserId: Record<number, number>;
  markOnline: (userId: number) => void;
  isLocallyOnline: (userId: number) => boolean;
};

function pruneExpired(map: Record<number, number>): Record<number, number> {
  const now = Date.now();
  const next: Record<number, number> = {};
  for (const [id, until] of Object.entries(map)) {
    if (until > now) next[Number(id)] = until;
  }
  return next;
}

export const usePresenceStore = create<PresenceState>()(
  persist(
    (set, get) => ({
      onlineUntilByUserId: {},
      markOnline: (userId) => {
        if (!userId) return;
        const until = Date.now() + LOCAL_ONLINE_TTL_MS;
        set((s) => ({
          onlineUntilByUserId: pruneExpired({
            ...s.onlineUntilByUserId,
            [userId]: until,
          }),
        }));
      },
      isLocallyOnline: (userId) => {
        if (!userId) return false;
        const until = get().onlineUntilByUserId[userId];
        return typeof until === "number" && until > Date.now();
      },
    }),
    {
      name: "soldmate-presence",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      ),
      partialize: (s) => ({ onlineUntilByUserId: s.onlineUntilByUserId }),
      onRehydrateStorage: () => (state) => {
        if (state?.onlineUntilByUserId) {
          state.onlineUntilByUserId = pruneExpired(state.onlineUntilByUserId);
        }
      },
    },
  ),
);
