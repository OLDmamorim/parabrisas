-- ===== TABELAS DE INVENTÁRIO =====
-- Criado em: 20 de Outubro de 2025
-- Sistema de inventário separado do registo diário

-- Tabela principal de inventários
CREATE TABLE IF NOT EXISTS inventarios (
  id SERIAL PRIMARY KEY,
  data_inventario TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER,
  user_email VARCHAR(255),
  loja VARCHAR(100),
  status VARCHAR(20) DEFAULT 'aberto',
  total_items INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de items de cada inventário
CREATE TABLE IF NOT EXISTS inventario_items (
  id SERIAL PRIMARY KEY,
  inventario_id INTEGER NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  hora TIME NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  veiculo TEXT,
  eurocode VARCHAR(20),
  marca VARCHAR(100),
  matricula VARCHAR(20),
  sm_loja VARCHAR(100),
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_inventarios_data ON inventarios(data_inventario DESC);
CREATE INDEX IF NOT EXISTS idx_inventarios_user ON inventarios(user_id);
CREATE INDEX IF NOT EXISTS idx_inventarios_loja ON inventarios(loja);
CREATE INDEX IF NOT EXISTS idx_inventario_items_inventario ON inventario_items(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_items_eurocode ON inventario_items(eurocode);

-- Comentários
COMMENT ON TABLE inventarios IS 'Tabela principal de inventários - cada linha representa um inventário completo';
COMMENT ON TABLE inventario_items IS 'Items individuais de cada inventário - vidros registados';
COMMENT ON COLUMN inventarios.status IS 'Status do inventário: aberto, fechado, cancelado';
COMMENT ON COLUMN inventario_items.tipo IS 'Tipo de vidro: PB, VTL, VTR, VTE, etc.';

