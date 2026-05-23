export type BackButtonHandler = () => boolean; // return true if handled, false to let it bubble

const handlers: BackButtonHandler[] = [];

/**
 * Registers a hardware back button handler.
 * Handlers are executed in reverse order of registration (LIFO).
 * If a handler returns true, the back event is consumed.
 * @returns a function to unregister the handler
 */
export const registerBackHandler = (handler: BackButtonHandler) => {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
};

export const handleHardwareBack = (): boolean => {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) {
      return true; // Event handled
    }
  }
  return false; // Event not handled
};
