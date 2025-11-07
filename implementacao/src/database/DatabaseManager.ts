import sqlite3 from 'sqlite3';
import path from 'path';

export class DatabaseManager {
  private db: sqlite3.Database;
  private static instance: DatabaseManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Erro ao conectar com o banco:', err);
      } else {
        console.log('Conexão com SQLite estabelecida');
        this.initTables();
        this.seedData();
      }
    });
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initTables(): void {
    console.log('Inicializando tabelas do banco de dados...');

    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS institutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('student', 'professor', 'company', 'admin')),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        rg TEXT,
        address TEXT,
        institution_id INTEGER NOT NULL REFERENCES institutions(id),
        course TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS professors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        department TEXT,
        institution_id INTEGER NOT NULL REFERENCES institutions(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cnpj TEXT UNIQUE NOT NULL,
        description TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER REFERENCES users(id),
        to_user_id INTEGER NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        reason TEXT,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('transfer', 'semester_credit', 'redemption')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS advantages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        cost_coins INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        advantage_id INTEGER NOT NULL REFERENCES advantages(id) ON DELETE CASCADE,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id),
        redemption_code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    this.db.exec(createTablesSQL, (err) => {
      if (err) {
        console.error('Erro ao criar tabelas:', err);
      } else {
        console.log('Tabelas criadas com sucesso!');
        this.isInitialized = true;
      }
    });
  }

  private seedData(): void {
    console.log('Inserindo dados iniciais...');

    // Hash da senha "password" para todos os usuários padrão
    const passwordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    const institutionsSQL = `
      INSERT OR IGNORE INTO institutions (name, address) VALUES 
      ('Universidade Federal de Tecnologia', 'Rua da Universidade, 123'),
      ('Instituto Tecnológico Nacional', 'Av. Tecnologia, 456'),
      ('Faculdade de Ciências Aplicadas', 'Rua das Ciências, 789');
    `;

    const usersSQL = `
      INSERT OR IGNORE INTO users (email, password, type) VALUES 
      ('admin@test.com', '${passwordHash}', 'admin'),
      ('aluno@test.com', '${passwordHash}', 'student'),
      ('empresa@test.com', '${passwordHash}', 'company');
    `;

    this.db.exec(institutionsSQL, (err) => {
      if (err) {
        console.error('Erro ao inserir instituições:', err);
      } else {
        console.log('Instituições inseridas com sucesso!');
      }
    });

    this.db.exec(usersSQL, (err) => {
      if (err) {
        console.error('Erro ao inserir usuários:', err);
      } else {
        console.log('Usuários padrão inseridos!');
        // Criar dados do aluno e empresa após os usuários serem criados
        this.createDefaultStudentAndCompany();
      }
    });
  }

  private createDefaultStudentAndCompany(): void {
    // Buscar IDs dos usuários criados
    this.db.get("SELECT id FROM users WHERE email = 'aluno@test.com'", (err, studentUser: any) => {
      if (err || !studentUser) {
        console.error('Erro ao buscar usuário aluno:', err);
        return;
      }

      // Criar aluno padrão
      const studentSQL = `
        INSERT OR IGNORE INTO students (user_id, name, cpf, rg, address, institution_id, course)
        VALUES (?, 'João Silva', '12345678901', '1234567', 'Rua dos Alunos, 100', 1, 'Engenharia de Software')
      `;
      
      this.db.run(studentSQL, [studentUser.id], (err) => {
        if (err) {
          console.error('Erro ao inserir aluno padrão:', err);
        } else {
          console.log('Aluno padrão criado com sucesso!');
        }
      });
    });

    this.db.get("SELECT id FROM users WHERE email = 'empresa@test.com'", (err, companyUser: any) => {
      if (err || !companyUser) {
        console.error('Erro ao buscar usuário empresa:', err);
        return;
      }

      // Criar empresa padrão
      const companySQL = `
        INSERT OR IGNORE INTO companies (user_id, name, cnpj, description, address, phone, email, website, is_active)
        VALUES (?, 'Empresa Parceira Exemplo', '12345678000190', 'Empresa parceira para demonstração do sistema', 'Av. Empresarial, 500', '(11) 99999-9999', 'empresa@test.com', 'https://empresa-exemplo.com', 1)
      `;
      
      this.db.run(companySQL, [companyUser.id], (err) => {
        if (err) {
          console.error('Erro ao inserir empresa padrão:', err);
        } else {
          console.log('Empresa padrão criada com sucesso!');
        }
      });
    });
  }

  public getDb(): sqlite3.Database {
    return this.db;
  }

  public isDbInitialized(): boolean {
    return this.isInitialized;
  }

  public async waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInitialization = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialization, 100);
        }
      };
      checkInitialization();
    });
  }

  public close(): void {
    this.db.close();
  }
}
