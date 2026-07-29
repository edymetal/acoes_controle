type ServiceWorkerControl = {
  controller: unknown;
  addEventListener: (
    type: "controllerchange",
    listener: () => void,
    options: { once: true },
  ) => void;
};

export function reloadOnFirstServiceWorkerControl(
  serviceWorker: ServiceWorkerControl,
  reload: () => void,
) {
  if (serviceWorker.controller) return false;

  let reloadRequested = false;
  serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequested) return;
    reloadRequested = true;
    reload();
  }, { once: true });
  return true;
}
