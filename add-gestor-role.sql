-- Adicionar role 'gestor' à base de dados
-- Execute este SQL no painel da Neon (https://console.neon.tech)

-- 1. Verificar roles atuais
SELECT DISTINCT role FROM users;

-- 2. Atualizar o utilizador marco amorim para 'gestor'
UPDATE users 
SET role = 'gestor' 
WHERE email = 'mramorim78@gmail.com';

-- 3. Confirmar a atualização
SELECT id, name, email, role 
FROM users 
WHERE email = 'mramorim78@gmail.com';

-- Resultado esperado:
-- role: gestor

-- Nota: Os roles disponíveis são:
-- - 'Admin' (administrador completo com gestão de utilizadores)
-- - 'gestor' (acesso a múltiplas tabelas e upload de eurocodes)
-- - 'user' (utilizador normal)

