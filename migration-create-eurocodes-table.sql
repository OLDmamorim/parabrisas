-- Migration: Criar tabela de eurocodes
-- Data: 20 de outubro de 2025
-- Descrição: Criar tabela para armazenar eurocodes (prefixos, marcas e modelos)
--            em substituição ao ficheiro estático eurocode-mapping.mjs

-- Criar tabela de eurocodes
CREATE TABLE IF NOT EXISTS eurocodes (
  id SERIAL PRIMARY KEY,
  prefix VARCHAR(4) UNIQUE NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para pesquisas rápidas por prefixo
CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix);

-- Criar índice para pesquisas por marca
CREATE INDEX IF NOT EXISTS idx_eurocodes_marca ON eurocodes(marca);

-- Adicionar comentários à tabela
COMMENT ON TABLE eurocodes IS 'Tabela de mapeamento de prefixos de eurocodes para marcas e modelos de veículos';
COMMENT ON COLUMN eurocodes.prefix IS 'Prefixo do eurocode (4 dígitos)';
COMMENT ON COLUMN eurocodes.marca IS 'Marca do veículo';
COMMENT ON COLUMN eurocodes.modelo IS 'Modelo do veículo (pode ser NULL)';
COMMENT ON COLUMN eurocodes.created_at IS 'Data de criação do registo';
COMMENT ON COLUMN eurocodes.updated_at IS 'Data da última atualização do registo';

