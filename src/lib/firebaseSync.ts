/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
 
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Obra, Empresa, Usuario, Reserva, Feriado, AuditoriaLog, SystemSettings } from '../types';
 
// ─── Documento Sinal ──────────────────────────────────────────────────────────
// Atualiza o campo correspondente à coleção no documento sistema/ultimaAlteracao.
// Isso notifica todos os usuários no modo econômico para buscar os dados novos.
// Usamos "skipSignal" nos exports de seeding para não acionar listeners durante inicialização.
export async function updateSignalDocument(collectionName: string) {
  try {
    const signalRef = doc(db, 'sistema', 'ultimaAlteracao');
    await setDoc(signalRef, { [collectionName]: serverTimestamp() }, { merge: true });
  } catch (err) {
    // Não bloqueia o fluxo principal se o sinal falhar
    console.warn(`[Signal] Falha ao atualizar sinal para '${collectionName}':`, err);
  }
}
 
// Inicializa o documento sinal com timestamps zerados para todas as coleções.
// Chamado uma única vez durante o seeding inicial.
export async function initializeSignalDocument() {
  try {
    const signalRef = doc(db, 'sistema', 'ultimaAlteracao');
    const snap = await getDoc(signalRef);
    if (!snap.exists()) {
      await setDoc(signalRef, {
        obras: serverTimestamp(),
        empresas: serverTimestamp(),
        usuarios: serverTimestamp(),
        feriados: serverTimestamp(),
        reservas: serverTimestamp(),
        logs: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('[Signal] Falha ao inicializar documento sinal:', err);
  }
}
 
// Helper to write a single document
// skipSignal=true é usado apenas durante o seeding para não acionar o documento sinal
export async function saveToFirestore<T extends { id: string }>(
  collectionName: string,
  element: T,
  skipSignal = false
) {
  try {
    const docRef = doc(db, collectionName, element.id);
    const sanitized = JSON.parse(JSON.stringify(element));
    await setDoc(docRef, sanitized);
    if (!skipSignal) {
      await updateSignalDocument(collectionName);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${element.id}`);
  }
}
 
// Helper to delete a single document
export async function deleteFromFirestore(
  collectionName: string,
  id: string
) {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    await updateSignalDocument(collectionName);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}
 
// Helper to write a batch of documents (useful for seeding or batch updates)
// skipSignal=true é usado durante o seeding
export async function saveBatchToFirestore<T extends { id: string }>(
  collectionName: string,
  elements: T[],
  skipSignal = false
) {
  try {
    const batch = writeBatch(db);
    elements.forEach(elem => {
      const docRef = doc(db, collectionName, elem.id);
      const sanitized = JSON.parse(JSON.stringify(elem));
      batch.set(docRef, sanitized);
    });
    await batch.commit();
    if (!skipSignal) {
      await updateSignalDocument(collectionName);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}
 
// Specific helper for system settings
// Settings tem seu próprio onSnapshot, mas também atualiza o sinal para consistência
export async function saveSystemSettings(settings: SystemSettings) {
  try {
    const docRef = doc(db, 'settings', 'system');
    const sanitized = JSON.parse(JSON.stringify(settings));
    await setDoc(docRef, sanitized);
    // Settings já tem onSnapshot dedicado; não precisa atualizar documento sinal
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/system');
  }
}
 
// Global function to seed Firestore with initial data if collections are empty
export async function seedRequiredCollections(
  initialObras: Obra[],
  initialEmpresas: Empresa[],
  initialUsuarios: Usuario[],
  initialFeriados: Feriado[],
  initialReservas: Reserva[],
  initialSettings: SystemSettings,
  initialLogs: AuditoriaLog[]
) {
  try {
    // Check if system settings document exists first.
    // If it exists, the database is already initialized; do not run any seeder code
    // to preserve deliberate custom changes or collections being completely emptied (like reservations).
    const settingsSnap = await getDoc(doc(db, 'settings', 'system'));
    if (settingsSnap.exists()) {
      console.log("Firestore settings document exists. Bypassing seeding to preserve custom modifications/deletions.");
      return;
    }
 
    // 1. Obras and detection of legacy seed from previous versions
    const obrasSnap = await getDocs(collection(db, 'obras'));
    let legacyDetected = false;
    obrasSnap.forEach(doc => {
      if (doc.id === 'o-bella-vista' || doc.id === 'o-admin') {
        legacyDetected = true;
      }
    });
 
    if (legacyDetected) {
      console.log("Legacy mock entries detected. Wiping collections to perform direct fresh seeding.");
      
      // Wipe obsolete worksites
      const bObras = writeBatch(db);
      obrasSnap.forEach(d => bObras.delete(d.ref));
      await bObras.commit();
 
      // Wipe obsolete users
      const snapU = await getDocs(collection(db, 'usuarios'));
      const bU = writeBatch(db);
      snapU.forEach(d => bU.delete(d.ref));
      await bU.commit();
 
      // Wipe obsolete reservations
      const snapR = await getDocs(collection(db, 'reservas'));
      const bR = writeBatch(db);
      snapR.forEach(d => bR.delete(d.ref));
      await bR.commit();
 
      // Wipe obsolete logs
      const snapL = await getDocs(collection(db, 'logs'));
      const bL = writeBatch(db);
      snapL.forEach(d => bL.delete(d.ref));
      await bL.commit();
 
      // Wipe obsolete holidays
      const snapF = await getDocs(collection(db, 'feriados'));
      const bF = writeBatch(db);
      snapF.forEach(d => bF.delete(d.ref));
      await bF.commit();
 
      // Now seed the clean structures directly (skipSignal=true durante seeding)
      await saveBatchToFirestore('obras', initialObras, true);
      await saveBatchToFirestore('empresas', initialEmpresas, true);
      await saveBatchToFirestore('usuarios', initialUsuarios, true);
      await saveBatchToFirestore('feriados', initialFeriados, true);
      await saveBatchToFirestore('reservas', initialReservas, true);
      await saveBatchToFirestore('logs', initialLogs, true);
      await saveSystemSettings(initialSettings);
      await initializeSignalDocument();
 
      console.log("Pristine environment seeded successfully!");
      return;
    }
 
    if (obrasSnap.empty) {
      await saveBatchToFirestore('obras', initialObras, true);
    }
 
    // 2. Empresas
    const empresasSnap = await getDocs(collection(db, 'empresas'));
    if (empresasSnap.empty) {
      await saveBatchToFirestore('empresas', initialEmpresas, true);
    }
 
    // 3. Usuarios
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    if (usuariosSnap.empty) {
      await saveBatchToFirestore('usuarios', initialUsuarios, true);
    }
 
    // 4. Feriados
    const feriadosSnap = await getDocs(collection(db, 'feriados'));
    if (feriadosSnap.empty) {
      await saveBatchToFirestore('feriados', initialFeriados, true);
    }
 
    // 5. Reservas
    const reservasSnap = await getDocs(collection(db, 'reservas'));
    if (reservasSnap.empty) {
      await saveBatchToFirestore('reservas', initialReservas, true);
    }
 
    // 6. Logs
    const logsSnap = await getDocs(collection(db, 'logs'));
    if (logsSnap.empty) {
      await saveBatchToFirestore('logs', initialLogs, true);
    }
 
    // 7. System Settings
    await saveSystemSettings(initialSettings);
    // 8. Inicializar documento sinal (se não existir)
    await initializeSignalDocument();
    console.log("Firestore seeding check completed successfully.");
  } catch (err) {
    console.warn("Seeding error (this may occur due to permissions before log-in, which is fully expected):", err);
  }
}
