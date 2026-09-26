import { useSyncExternalStore } from "react";
import { store, type ClientState } from "./store.js";

export function useStore(): ClientState {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
    () => store.get(),
  );
}
