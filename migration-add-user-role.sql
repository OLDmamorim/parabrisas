-- Migração: Adicionar campo role à tabela users
-- Execute este script na base de dados Neon

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'user';
        
        RAISE NOTICE 'Coluna role adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna role já existe';
    END IF;
END $$;

-- Atualizar utilizador admin (mramorim78@gmail.com) para role 'gestor'
UPDATE users
SET role = 'gestor'
WHERE email = 'mramorim78@gmail.com';

-- Verificar resultado
SELECT id, email, role FROM users ORDER BY role DESC, email;

