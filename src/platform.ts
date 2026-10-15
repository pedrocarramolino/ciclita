/** La app está abierta como app instalada (desde la pantalla de inicio). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPhone o iPad (los iPad recientes se presentan como Mac con pantalla táctil). */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
