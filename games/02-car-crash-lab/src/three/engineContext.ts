import { createContext, useContext } from 'react';
import { CrashEngine } from '../physics/engine';

export const EngineContext = createContext<CrashEngine | null>(null);

export function useEngine(): CrashEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('EngineContext is missing');
  return engine;
}
