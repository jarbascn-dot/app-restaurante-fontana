import bcrypt from 'bcryptjs';

/**
 * Verifica se a string fornecida já é um hash bcrypt válido.
 * Hashes do bcrypt geralmente começam com $2a$, $2b$ ou $2y$ e possuem exatamente 60 caracteres.
 */
export function isHash(password: string): boolean {
  if (!password) return false;
  return password.startsWith('$2') && password.length === 60;
}

/**
 * Gera um hash seguro da senha usando bcryptjs.
 * Se o valor já for um hash, retorna-o diretamente sem gerar hash novamente.
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  if (isHash(password)) return password;
  return bcrypt.hashSync(password, 10);
}

/**
 * Compara uma senha digitada em texto puro com a senha salva no banco.
 * Suporta comparação segura via bcrypt (se estiver em formato de hash) ou
 * comparação de igualdade simples (caso seja uma senha legada em texto puro).
 */
export function comparePassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (isHash(stored)) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch (e) {
      console.error('[Security] Falha ao comparar hash do bcrypt:', e);
      return false;
    }
  }
  // Migração transparente: suporte a senhas antigas em texto puro
  return password === stored;
}
