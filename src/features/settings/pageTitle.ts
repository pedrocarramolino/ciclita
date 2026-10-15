import { createContext } from 'react'

/** Título de la página de Ajustes abierta: la sección con ese mismo título no lo repite. */
export const PageTitle = createContext<string | null>(null)
