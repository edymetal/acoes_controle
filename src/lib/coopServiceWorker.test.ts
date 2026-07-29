import { describe, expect, it, vi } from "vitest";
import { reloadOnFirstServiceWorkerControl } from "./coopServiceWorker";

describe("reloadOnFirstServiceWorkerControl", () => {
  it("não recarrega quando a página já está sob controle do service worker", () => {
    const addEventListener = vi.fn();
    const reload = vi.fn();

    expect(reloadOnFirstServiceWorkerControl({
      controller: {},
      addEventListener,
    }, reload)).toBe(false);
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("recarrega uma única vez quando o primeiro service worker assume o controle", () => {
    let onControllerChange: (() => void) | undefined;
    const reload = vi.fn();
    const addEventListener = vi.fn((
      _type: "controllerchange",
      listener: () => void,
    ) => {
      onControllerChange = listener;
    });

    expect(reloadOnFirstServiceWorkerControl({
      controller: null,
      addEventListener,
    }, reload)).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true },
    );

    onControllerChange?.();
    onControllerChange?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
