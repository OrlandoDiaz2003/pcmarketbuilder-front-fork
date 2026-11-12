/** Una fila de métrica de analytics-service: key es la clave de agrupación y label lo que se muestra. */
export interface Metric {
  key: string;
  label: string | null;
  count: number;
  /** Suma en CLP (ventas); 0 en las métricas que solo cuentan. */
  amount: number;
}

/** Una acción del registro de auditoría (quién hizo qué). */
export interface AuditEntry {
  eventId: string;
  eventType: string;
  source: string | null;
  actorId: string | null;
  /** Nombre de usuario de quien hizo la acción, si se conoce. */
  actorName: string | null;
  occurredAt: string;
  payload: string | null;
}
