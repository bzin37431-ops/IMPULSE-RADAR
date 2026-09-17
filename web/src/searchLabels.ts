export const searchModeLabel=(value:string)=>({PRINCIPAL:'Fraco',ALTERNATIVA:'Médio',AMPLIADA:'Ultra'} as Record<string,string>)[value]||value;
export const searchStatusLabel=(value:string)=>({QUEUED:'Na fila',RUNNING:'Em andamento',COMPLETED:'Concluída',FAILED:'Falhou',CANCELLED:'Cancelada'} as Record<string,string>)[value]||value;
