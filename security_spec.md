# Security Specification (TDD) for SGR Fontana Firestore

## 1. Data Invariants
- An active meal reservation (`Reserva`) cannot exist for a non-approved or blocked user.
- Audit logs (`AuditoriaLog`) are strictly append-only; updates and deletions are mathematically blocked.
- User accounts (`Usuario`) can only register through authentic registration forms. A user profile cannot self-appoint high-level roles (`Perfil.Admin` or `Perfil.Gestor`).
- System-wide parameters (`SystemSettings`) in `/settings/system` can only be updated by authenticated Administrators (`Perfil.Admin`).
- Timestamps (`criadoEm`, `alteradoEm`, `dataHora`) must align with server time when created or updated.

---

## 2. The "Dirty Dozen" Malicious Payloads

### Payload 1: Privilege Escalation via Initial Registration
Malicious user tries to set their role directly to `admin`.
```json
{
  "id": "malicious-user-uid",
  "nome": "Hacker Master",
  "email": "hacker@fontana.com.br",
  "matricula": "M-HACK",
  "perfil": "admin",
  "status": "aprovado",
  "idEmpresa": "e-1",
  "idObraPadrao": "o-1",
  "criadoEm": "2026-06-15T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 2: Illegal Field Injection in Reservation Update
Attempting to inject a ghost property `discountedCost` to compromise transaction history.
```json
{
  "id": "r-12345",
  "idUsuario": "u-user",
  "data": "2026-06-15",
  "status": "reservado",
  "consumido": true,
  "idObraNoDia": "o-1",
  "alteradoEm": "2026-06-15T12:00:00Z",
  "ipOrigem": "127.0.0.1",
  "dispositivo": "Unknown Device",
  "discountedCost": 0
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 3: Spoofing Owner ID on Booking Reservation
Creating a booking reservation list under another worker's identity.
```json
{
  "id": "r-9999",
  "idUsuario": "victim-user-id",
  "data": "2026-06-15",
  "status": "reservado",
  "consumido": false,
  "idObraNoDia": "o-1",
  "alteradoEm": "2026-06-15T12:00:00Z",
  "ipOrigem": "127.0.0.1",
  "dispositivo": "Simulator Browser"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 4: Overwriting Permanent Logs of Audit
Trying to delete or update an existing audit trail entry.
```json
// UPDATE to /logs/log-1
{
  "id": "log-1",
  "usuarioNome": "Admin",
  "usuarioEmail": "admin@fontana.com.br",
  "dataHora": "2026-06-14T08:00:00Z",
  "operacao": "CLEARED LOG - NOTHING TO SEE HERE",
  "ip": "222.222.222.222",
  "dispositivo": "Incognito Hack",
  "perfil": "admin"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 5: Spoofing Server Timestamp for Past Logging
Tricking the database into accepting client timestamp inside log creations.
```json
{
  "id": "log-hack",
  "usuarioNome": "Liar User",
  "usuarioEmail": "liar@fontana.com.br",
  "dataHora": "2020-01-01T00:00:00Z",
  "operacao": "Backdated action logging",
  "ip": "127.0.0.1",
  "dispositivo": "Liar App",
  "perfil": "colaborador"
}
```
*Expected Result: PERMISSION_DENIED (Must equal request.time)*

### Payload 6: Modifying System Settings without Admin Permissions
A standard `colaborador` attempting to modify cut-off hours to bypass the morning block.
```json
// Write to /settings/system by Colaborador
{
  "horarioLimite": "11:59",
  "permitirFinsDeSemana": true,
  "valorRefeicaoPropria": 0,
  "valorRefeicaoTerceiro": 0,
  "usarTabletRetirada": false,
  "requererBiometriaFacial": false,
  "permitirSimulador": true
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 7: Reading PII Fields of All Registered Users Blanket-wise
Unauthenticated query attempting to lists all user objects to scrape corporate email addresses.
```sql
SELECT * FROM usuarios;
```
*Expected Result: PERMISSION_DENIED (Blanket reads without owner verification or admin privilege blocked)*

### Payload 8: Creating Obra without Proper Authorization
Standard user attempting to insert mock construction site for cost redirecting.
```json
{
  "id": "o-fake",
  "nome": "Obra Fantasma",
  "centroCusto": "999-FAKE",
  "ativa": true
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 9: Self-Approving Pending Account State
A pending employee attempting to transition their own status to `aprovado`.
```json
{
  "id": "pending-uid",
  "nome": "Worker",
  "email": "worker@fontana.com.br",
  "matricula": "M-111",
  "perfil": "colaborador",
  "status": "aprovado",
  "idEmpresa": "e-1",
  "idObraPadrao": "o-1",
  "criadoEm": "2026-06-15T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 10: Injecting Giant String as Document Key (Denial of Wallet)
Attempting to create a booking reservation with a 1.2MB key acting as document ID.
```json
{
  "id": "A_GIANT_RECURSIVE_KEY_THAT_KEEPS_STRETCHING_..."
}
```
*Expected Result: PERMISSION_DENIED (isValidId size limit checks)*

### Payload 11: Deactivating Active Companies by External Actors
Maliciously updating an existing general enterprise classified status.
```json
{
  "id": "e-1",
  "nome": "Fontana S.A.",
  "tipo": "Propria",
  "deleted": true
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 12: Orphaned Reservation Creation
Creating a reservation targeting an invalid, non-established usuario ID reference.
```json
{
  "id": "r-orphaned",
  "idUsuario": "non-existent-user-uid",
  "data": "2026-06-16",
  "status": "reservado",
  "consumido": false,
  "idObraNoDia": "o-1",
  "alteradoEm": "2026-06-15T12:00:00Z",
  "ipOrigem": "127.0.0.1",
  "dispositivo": "Hacker App"
}
```
*Expected Result: PERMISSION_DENIED (Exists check)*

---

## 3. The Test Runner Reference

These conditions are mathematically mapped inside the primary assertions of `firestore.rules`.
Each match group enforces:
1. Validations of parameters using non-static database assertions (`exists`, `get`).
2. Exact size validations of payload parameters to block phantom attributes.
3. Access privileges and tier boundaries defined natively in the database.
