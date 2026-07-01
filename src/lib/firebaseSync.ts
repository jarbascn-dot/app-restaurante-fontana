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
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Obra, Empresa, Usuario, Reserva, Feriado, AuditoriaLog, SystemSettings } from '../types';

// Helper to write a single document
export async function saveToFirestore<T extends { id: string }>(
  collectionName: string,
  element: T
) {
  try {
    const docRef = doc(db, collectionName, element.id);
    const sanitized = JSON.parse(JSON.stringify(element));
    await setDoc(docRef, sanitized);
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
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// Helper to write a batch of documents (useful for seeding or batch updates)
export async function saveBatchToFirestore<T extends { id: string }>(
  collectionName: string,
  elements: T[]
) {
  try {
    const batch = writeBatch(db);
    elements.forEach(elem => {
      const docRef = doc(db, collectionName, elem.id);
      const sanitized = JSON.parse(JSON.stringify(elem));
      batch.set(docRef, sanitized);
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

// Specific helper for system settings
export async function saveSystemSettings(settings: SystemSettings) {
  try {
    const docRef = doc(db, 'settings', 'system');
    const sanitized = JSON.parse(JSON.stringify(settings));
    await setDoc(docRef, sanitized);
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

      // Now seed the clean structures directly
      await saveBatchToFirestore('obras', initialObras);
      await saveBatchToFirestore('empresas', initialEmpresas);
      await saveBatchToFirestore('usuarios', initialUsuarios);
      await saveBatchToFirestore('feriados', initialFeriados);
      await saveBatchToFirestore('reservas', initialReservas);
      await saveBatchToFirestore('logs', initialLogs);
      await saveSystemSettings(initialSettings);
      
      console.log("Pristine environment seeded successfully!");
      return;
    }

    if (obrasSnap.empty) {
      await saveBatchToFirestore('obras', initialObras);
    }

    // 2. Empresas
    const empresasSnap = await getDocs(collection(db, 'empresas'));
    if (empresasSnap.empty) {
      await saveBatchToFirestore('empresas', initialEmpresas);
    }

    // 3. Usuarios
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    if (usuariosSnap.empty) {
      await saveBatchToFirestore('usuarios', initialUsuarios);
    }

    // 4. Feriados
    const feriadosSnap = await getDocs(collection(db, 'feriados'));
    if (feriadosSnap.empty) {
      await saveBatchToFirestore('feriados', initialFeriados);
    }

    // 5. Reservas
    const reservasSnap = await getDocs(collection(db, 'reservas'));
    if (reservasSnap.empty) {
      await saveBatchToFirestore('reservas', initialReservas);
    }

    // 6. Logs
    const logsSnap = await getDocs(collection(db, 'logs'));
    if (logsSnap.empty) {
      await saveBatchToFirestore('logs', initialLogs);
    }

    // 7. System Settings
    await saveSystemSettings(initialSettings);
    console.log("Firestore seeding check completed successfully.");
  } catch (err) {
    console.warn("Seeding error (this may occur due to permissions before log-in, which is fully expected):", err);
  }
}
