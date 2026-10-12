import { useEffect, useState } from "react";
import { listOutbox, subscribeOutbox } from "@/offline/outbox";
import type { ActionType, OutboxAction } from "@/offline/types";

/** Acciones de la cola offline, actualizadas en vivo. Con `type`, solo las de ese tipo. */
export function useOutbox<T extends ActionType = ActionType>(type?: T): OutboxAction<T>[] {
  const [actions, setActions] = useState<OutboxAction[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => void listOutbox().then((list) => !cancelled && setActions(list));
    load();
    const unsubscribe = subscribeOutbox(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (type ? actions.filter((action) => action.type === type) : actions) as OutboxAction<T>[];
}
