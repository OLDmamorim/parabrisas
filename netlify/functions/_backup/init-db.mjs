import { sql, init } from './db.mjs';
import { hashPassword } from './auth-utils.mjs';

export async function initAuthDatabase() {
  try {
    // Inicializar conexão
    await init();
    
    console.log('🔧 Inicializando sistema de autenticação...');

    // 1. Criar tabela users se não existir
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Tabela users criada/verificada');

    // 2. Verificar se tabela ocr_results tem coluna user_id
    try {
      await sql`ALTER TABLE ocr_results ADD COLUMN user_id INTEGER REFERENCES users(id)`;
      console.log('✅ Coluna user_id adicionada à tabela ocr_results');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Coluna user_id já existe na tabela ocr_results');
      } else {
        console.log('⚠️ Erro ao adicionar coluna user_id:', error.message);
      }
    }

    // 3. Verificar se admin já existe
    const existingAdmin = await sql`
      SELECT id FROM users WHERE email = 'admin@expressglass.com'
    `;

    if (existingAdmin.length === 0) {
      // 4. Criar utilizador admin padrão
      const adminPassword = await hashPassword('Admin123!');
      
      const admin = await sql`
        INSERT INTO users (email, password_hash, name, role, active)
        VALUES ('admin@expressglass.com', ${adminPassword}, 'Administrador', 'admin', true)
        RETURNING id, email, name, role
      `;
      
      console.log('✅ Utilizador admin criado:', admin[0]);

      // 5. Associar registos existentes ao admin (se existirem)
      const existingRecords = await sql`
        SELECT COUNT(*) as count FROM ocr_results WHERE user_id IS NULL
      `;

      if (existingRecords[0].count > 0) {
        await sql`
          UPDATE ocr_results 
          SET user_id = ${admin[0].id} 
          WHERE user_id IS NULL
        `;
        console.log(`✅ ${existingRecords[0].count} registos existentes associados ao admin`);
      }
    } else {
      console.log('✅ Utilizador admin já existe');
    }

    // 6. Criar índices para performance
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_ocr_results_user_id ON ocr_results(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      console.log('✅ Índices criados/verificados');
    } catch (error) {
      console.log('⚠️ Erro ao criar índices:', error.message);
    }

    console.log('🎉 Sistema de autenticação inicializado com sucesso!');
    
    return {
      success: true,
      message: 'Base de dados inicializada com sucesso!',
      details: {
        tablesCreated: ['users'],
        columnsAdded: ['ocr_results.user_id'],
        adminCreated: existingAdmin.length === 0,
        indexesCreated: true
      }
    };

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    throw new Error(`Erro na inicialização da base de dados: ${error.message}`);
  }
}
