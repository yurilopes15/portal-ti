// Mapeamento de grupos operacionais do inventário para nomes de categorias.
// Os nomes devem casar (case-insensitive) com registros em inventory_categories.
// Categorias que não existirem são simplesmente ignoradas no filtro.

export const INVENTORY_GROUPS = {
  computadores: {
    label: "Computadores",
    icon: "💻",
    categorias: ["Desktop", "Notebook", "Computador", "PC"],
  },
  monitores: {
    label: "Monitores",
    icon: "🖥️",
    categorias: ["Monitor"],
  },
  impressoras: {
    label: "Impressoras",
    icon: "🖨️",
    categorias: ["Impressora", "Multifuncional"],
  },
  telefones: {
    label: "Telefones",
    icon: "☎️",
    categorias: ["Telefone", "Ramal", "Telefone IP"],
  },
  rede: {
    label: "Equipamentos de Rede",
    icon: "🌐",
    categorias: ["Access Point", "Switch", "Firewall", "Roteador", "Modem"],
  },
  celulares: {
    label: "Celulares",
    icon: "📱",
    categorias: ["Celular Corporativo", "Celular", "Smartphone"],
  },
  licencas: {
    label: "Licenças",
    icon: "🔑",
    categorias: ["Licenças", "Licença", "Licenca"],
  },

} as const;

export type InventoryGroupKey = keyof typeof INVENTORY_GROUPS;

export const INVENTORY_GROUP_KEYS = Object.keys(INVENTORY_GROUPS) as InventoryGroupKey[];
