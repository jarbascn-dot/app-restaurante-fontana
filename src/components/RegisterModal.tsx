/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Usuario, Perfil, UserStatus, Obra, Empresa } from '../types';
import { UserPlus, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  obras: Obra[];
  empresas: Empresa[];
  onRegister: (newUser: Usuario, message: string) => void;
}

export default function RegisterModal({ isOpen, onClose, obras, empresas, onRegister }: RegisterModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  
  const [successMsg, setSuccessMsg] = useState<{ text: string; autoApproved: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !senha) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // All registrations now default to Pending so HR can register their company, matricula, sector, and profile.
    const status = UserStatus.Pendente;

    const newUser: Usuario = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      nome,
      email,
      senha,
      matricula: '', // to be filled by HR on approval
      perfil: Perfil.Colaborador, // to be edited/assigned by HR on approval
      status,
      idEmpresa: '', // to be filled by HR on approval
      idObraPadrao: '', // to be filled by HR on approval
      criadoEm: new Date().toISOString()
    };

    const msg = `Solicitação de cadastro recebida! Aguarde a aprovação do RH para preenchimento de sua matrícula, empresa vinculada, setor/área (obra) e perfil de acesso.`;
    setSuccessMsg({ text: msg, autoApproved: false });

    onRegister(newUser, msg);
  };

  const handleFinish = () => {
    setSuccessMsg(null);
    setNome('');
    setEmail('');
    setSenha('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="register-modal-overlay">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-100 flex flex-col" id="register-modal-container">
        
        {/* Header */}
        <div className="bg-neutral-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-lg tracking-tight">Solicitar Cadastro no SGR</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white transition-colors"
            id="modal-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successMsg ? (
          /* Success screen */
          <div className="p-8 text-center flex flex-col items-center gap-4" id="register-success-view">
            {successMsg.autoApproved ? (
              <div className="bg-emerald-100 text-emerald-700 p-4 rounded-full">
                <CheckCircle className="h-12 w-12" />
              </div>
            ) : (
              <div className="bg-amber-100 text-amber-700 p-4 rounded-full">
                <AlertTriangle className="h-12 w-12" />
              </div>
            )}
            
            <h4 className="text-xl font-bold text-neutral-800">
              {successMsg.autoApproved ? 'Acesso Liberado!' : 'Solicitação Recebida'}
            </h4>
            <p className="text-sm text-neutral-600 leading-relaxed max-w-sm">
              {successMsg.text}
            </p>

            <button
              onClick={handleFinish}
              className="mt-4 px-6 py-2.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium text-sm"
              id="success-finish-btn"
            >
              Concluir e Fechar
            </button>
          </div>
        ) : (
          /* Form screen */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto" id="register-form">
            <div className="bg-neutral-50 border-l-4 border-emerald-500 p-3.5 rounded">
              <p className="text-xs text-neutral-600 font-medium">
                💡 **Segurança e Triagem Ativa:** Conforme as diretrizes de compliance, seus dados de **Matrícula**, **Empresa Vinculada**, **Setor/Área (Obra)** e **Perfil de Acesso** serão obrigatoriamente preenchidos e validados pelo RH no momento da aprovação do cadastro.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex. José Ribamar da Silva"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                id="reg-nome"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">E-mail Corporativo ou Pessoal *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jose.silva@email.com"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                id="reg-email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Senha de Acesso *</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Defina uma senha"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                id="reg-senha"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm hover:bg-neutral-50 transition-colors"
                id="cancel-reg-btn"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow transition-colors flex items-center gap-1.5"
                id="submit-reg-btn"
              >
                <UserPlus className="h-4 w-4" /> Solicitar Cadastro
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
