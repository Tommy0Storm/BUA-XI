// utils/uiUtils.ts

export function defer(fn: () => void) {
    if ("requestIdleCallback" in window)
        (window as any).requestIdleCallback(fn);
    else
        Promise.resolve().then(fn);
}