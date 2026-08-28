import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Check, Eye, EyeOff } from 'lucide-react';
import { Usuario } from '../types';

interface FirstAccessPasswordResetModalProps {
  isOpen: boolean;
  currentUser: Usuario;
  onSubmit: (newPassword: string) => void;
}

export default function FirstAccessPasswordResetModal({
  isOpen,
  currentUser,
  onSubmit,
}: FirstAccessPasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword.trim()) {
      setError('Por favor, informe a nova senha deseja.');
      return;
    }

    if (newPassword.length < 4) {
      setError('A nova senha precisa conter no mínimo 4 caracteres como medida de proteção corporativa.');
      return;
    }

    if (newPassword === '1234@') {
      setError('Sua nova senha deve ser diferente da senha provisória padrão ("1234@"). No intuito de preservar a privacidade do seu usuário, cadastre um código pessoal único.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem. Repita o mesmo código em ambos os campos.');
      return;
    }

    onSubmit(newPassword);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in" id="password-reset-overlay">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-neutral-900 text-white px-6 py-6 text-center relative border-b border-neutral-800">
          <div className="inline-flex bg-amber-550/10 text-amber-500 p-3.5 rounded-full border border-amber-500/20 mb-3 items-center justify-center animate-pulse">
            <KeyRound className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">Alteração Obrigatória de Senha</h3>
          <p className="text-[11px] text-neutral-400 mt-1 uppercase tracking-widest font-mono">Primeiro Acesso ou Redefinição Administrativa</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-850">Prezado(a) {currentUser.nome},</p>
              <p className="text-[11px] text-neutral-600 leading-normal mt-0.5">
                Você recebeu uma <strong>senha provisória</strong> criada administrativamente pelo RH. 
                Por rígidas diretrizes corporativas de segurança e para impedir que sua assinatura de reservas seja acessada por terceiros, crie seu código secreto de acesso definitivo agora mesmo.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold font-sans animate-shake">
              ⚠️ {error}
            </div>
          )}

          {/* New Password field */}
          <div className="space-y-1">
            <label className="block text-[10px] text-neutral-500 uppercase font-black" htmlFor="pwd-new-pass">Nova Senha Desejada *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="pwd-new-pass"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="w-full pl-3 pr-10 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password field */}
          <div className="space-y-1">
            <label className="block text-[10px] text-neutral-500 uppercase font-black" htmlFor="pwd-confirm-pass">Repita a Nova Senha *</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="pwd-confirm-pass"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita exatamente a senha acima"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Tips list */}
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-250/50 space-y-1.5">
            <span className="block text-[10px] font-bold text-neutral-500 uppercase font-mono">Dicas para criar um bom código:</span>
            <ul className="text-[10px] text-neutral-505 space-y-1 font-sans">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Escolha letras, números ou caracteres especiais (ex. @, !, #, $)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Não compartilhe essa senha com outros operadores no canteiro de obras</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Caso você possua Biometria Celular ativa, faça login uma primeira vez com seu novo código para que sua digital seja vinculada à nova chave</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              id="submit-password-reset"
            >
              Confirmar Nova Senha e Ativar Acesso 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
