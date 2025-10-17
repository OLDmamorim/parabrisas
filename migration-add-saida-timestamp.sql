-- Migração: Adicionar coluna saida_timestamp à tabela ocr_results
-- Execute este script na base de dados Neon

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ocr_results' 
        AND column_name = 'saida_timestamp'
    ) THEN
        ALTER TABLE ocr_results 
        ADD COLUMN saida_timestamp TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Coluna saida_timestamp adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna saida_timestamp já existe';
    END IF;
END $$;

-- Opcional: Atualizar registos existentes que têm saída mas não têm timestamp
-- (usa o updated_at como referência)
UPDATE ocr_results
SET saida_timestamp = updated_at
WHERE observacoes IN ('SERVIÇO', 'DEVOLUÇÃO', 'QUEBRAS', 'OUTRO')
  AND saida_timestamp IS NULL
  AND updated_at IS NOT NULL;

