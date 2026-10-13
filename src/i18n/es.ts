/** Textos en español. Estructura preparada para añadir más idiomas. */
export const es = {
  appName: 'Ciclo',
  legal: 'Esta app no es un método anticonceptivo ni sustituye el consejo médico.',
  common: {
    next: 'Continuar',
    back: 'Atrás',
    dontKnow: 'No lo sé',
    days: 'días',
  },
  onboarding: {
    stepOf: (n: number, total: number) => `Paso ${n} de ${total}`,
    welcomeTitle: 'Tu ciclo, a tu manera',
    welcomeBody:
      'Registra tu periodo, tus síntomas y cómo te sientes en pocos toques, y conoce mejor tus patrones.',
    privacyTitle: 'Privado de verdad',
    privacyPoints: [
      'Tus datos se guardan solo en este dispositivo.',
      'Sin cuentas, sin servidores, sin analítica ni rastreadores.',
      'Puedes exportarlos o borrarlos cuando quieras.',
    ],
    start: 'Empezar',
    lastPeriodTitle: '¿Cuándo empezó tu último periodo?',
    lastPeriodHint: 'Nos sirve para estimar tu próximo periodo. Podrás cambiarlo después.',
    lastPeriodLabel: 'Fecha de inicio',
    lengthsTitle: '¿Cuánto suelen durar?',
    lengthsHint: 'Si no lo sabes, usaremos 28 y 5 días y lo ajustaremos con tus registros.',
    cycleLabel: 'Duración del ciclo',
    cycleHelp: 'Del primer día de un periodo al primer día del siguiente',
    periodLabel: 'Duración del periodo',
    finish: 'Listo',
  },
  home: {
    ready: 'Todo listo',
    soon: 'La pantalla de inicio, el calendario y el registro diario llegan en las próximas fases.',
  },
}

export const t = es
