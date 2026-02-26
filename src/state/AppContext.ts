import { createContext, useContext } from 'react'
import type { AppState, AppAction } from './appReducer'
import { initialState } from './appReducer'

export const AppStateContext = createContext<AppState>(initialState)
export const AppDispatchContext = createContext<React.Dispatch<AppAction>>(() => {})

export function useAppState() {
  return useContext(AppStateContext)
}

export function useAppDispatch() {
  return useContext(AppDispatchContext)
}
