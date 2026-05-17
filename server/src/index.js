require('dotenv').config();
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const morgan = require('morgan');
const seedData = require('./seed-data');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] }
});
const port = process.env.PORT || 4000;

// ─── Firebase Setup ──────────────────────────────────────────────────────────
let firestore = null;
function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  return null;
}
try {
  const sa = parseServiceAccount();
  if (sa) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    firestore = admin.firestore();
    console.log('✅ Firebase Admin connected');
  } else {
    console.warn('⚠️  No Firebase credentials found — running without Firestore');
  }
} catch (e) { console.warn(`Firebase init failed: ${e.message}`); }

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Socket.IO Connection ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

// ─── Firestore Helpers ───────────────────────────────────────────────────────
const col = (name) => firestore.collection(name);
const ts = () => new Date().toISOString();

async function getAll(collection, filters = {}) {
  let q = col(collection);
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') q = q.where(k, '==', v);
  }
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getDoc(collection, id) {
  const doc = await col(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function addDoc(collection, data, customId) {
  if (customId) {
    await col(collection).doc(customId).set(data);
    return { id: customId, ...data };
  }
  const ref = await col(collection).add(data);
  return { id: ref.id, ...data };
}

async function updateDoc(collection, id, data) {
  await col(collection).doc(id).update(data);
}

async function deleteDoc(collection, id) {
  await col(collection).doc(id).delete();
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
async function verifyFirebaseUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { req.firebaseUser = null; return next(); }
  if (!admin.apps.length) { req.firebaseUser = { uid: 'unverified-local', email: req.body?.email }; return next(); }
  try { req.firebaseUser = await admin.auth().verifyIdToken(token); next(); }
  catch { res.status(401).json({ error: 'Invalid Firebase token' }); }
}

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luminest-unified-api', firestore: !!firestore, timestamp: ts() });
});

// ─── Seed ────────────────────────────────────────────────────────────────────
app.post('/seed', async (_req, res) => {
  if (!firestore) return res.status(500).json({ error: 'Firestore not connected' });
  try {
    for (const d of seedData.doctors) await col('doctors').doc(d.id).set(d);
    for (const p of seedData.patients) await col('patients').doc(p.id).set(p);
    for (const c of seedData.checkins) await col('checkins').doc(c.id).set(c);
    for (const r of seedData.reports) await col('reports').doc(r.id).set(r);
    for (const n of seedData.notes) await col('notes').doc(n.id).set(n);
    io.emit('data:seeded');
    res.json({ ok: true, message: 'Database seeded', counts: { doctors: seedData.doctors.length, patients: seedData.patients.length, checkins: seedData.checkins.length, reports: seedData.reports.length, notes: seedData.notes.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Auth ────────────────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { role = 'patient', email } = req.body || {};
  if (firestore) {
    const users = await getAll('users', { role });
    const user = users.find(u => !email || u.email === email) || users[0];
    if (user) return res.json({ token: `demo_${user.id}_${Date.now()}`, user });
  }
  const fallback = role === 'doctor' ? { id: 'dr_001', role: 'doctor', name: 'Dr. Divya K' } : { id: 'couple_001', role: 'patient', name: 'Priya & Arjun' };
  res.json({ token: `demo_${fallback.id}_${Date.now()}`, user: fallback });
});

app.post('/auth/profile', verifyFirebaseUser, async (req, res) => {
  const { role = 'patient', name, email } = req.body || {};
  const uid = req.firebaseUser?.uid || `local_${Date.now()}`;
  const profile = {
    uid, role, name: name || email || 'LumiNest User', email: email || '',
    avatar: (name || email || 'LN').split(/[ &@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'LN',
    package: role === 'patient' ? 'Sprout' : undefined,
    week: role === 'patient' ? 1 : undefined,
    cycleDay: role === 'patient' ? 1 : undefined,
    updatedAt: ts()
  };
  if (firestore) await col('users').doc(uid).set(profile, { merge: true });
  res.status(201).json({ user: { id: uid, ...profile } });
});

// ─── Doctors ─────────────────────────────────────────────────────────────────
app.get('/doctors', async (_req, res) => {
  if (!firestore) return res.json({ doctors: seedData.doctors });
  res.json({ doctors: await getAll('doctors') });
});

// ─── Patient Dashboard ──────────────────────────────────────────────────────
const patientDash = {
  stats: [{ label: 'Program week', value: '3/8', tag: 'Sprout' }, { label: 'Cycle day', value: '13', tag: 'Fertile soon' }, { label: 'Daily streak', value: '6', tag: 'Great' }],
  dailyTasks: ['Track energy', 'Log cervical mucus', 'Drink 2.5L water', 'Evening walk'],
  journey: [{ title: 'Foundation', status: 'done', body: 'Cycle awareness, sleep rhythm, and daily check-in habit.' }, { title: 'Fertile Window', status: 'current', body: 'Track mucus, BBT, intimacy timing, and stress recovery.' }, { title: 'Nourish', status: 'next', body: 'Food, movement, and emotional support for the luteal phase.' }],
  bbt: [36.4, 36.5, 36.3, 36.6, 36.5, 36.4, 36.7, 36.6, 36.5, 36.6, 36.8, 36.7, 36.5, 36.9]
};

app.get('/dashboard/patient', verifyFirebaseUser, async (req, res) => {
  let notes = [], recentLogs = [];
  if (firestore) {
    notes = await getAll('notes');
    recentLogs = (await getAll('reports')).slice(-5).reverse();
  }
  const uid = req.firebaseUser?.uid;
  let user = uid && firestore ? await getDoc('users', uid) : null;
  if (!user) user = { id: 'couple_001', name: 'Priya & Arjun', role: 'patient', package: 'Sprout', week: 3, cycleDay: 13 };
  res.json({ user, notes, recentLogs, ...patientDash });
});

// ─── Doctor Dashboard ────────────────────────────────────────────────────────
app.get('/dashboard', async (req, res) => {
  if (!firestore) return res.json({ stats: { totalPatients: 0, pendingReviews: 0, onTrackPercent: 0, activeLoggers: 0 }, recentCheckins: [], focusList: [] });
  const doctorId = req.query.doctorId || null;
  let patients = await getAll('patients');
  if (doctorId) patients = patients.filter(p => p.assignedDoctor === doctorId);
  let checkins = await getAll('checkins');
  if (doctorId) checkins = checkins.filter(c => { const p = patients.find(pp => pp.id === c.coupleId); return !!p; });
  const pending = checkins.filter(c => c.status === 'pending');
  const onTrack = patients.filter(p => p.status === 'On track').length;
  const pct = patients.length > 0 ? Math.round((onTrack / patients.length) * 100) : 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const reports = await getAll('reports');
  const activeLoggers = new Set(reports.filter(r => r.date >= weekAgo).map(r => r.coupleId)).size;
  res.json({
    stats: { totalPatients: patients.length, pendingReviews: pending.length, onTrackPercent: pct, activeLoggers },
    recentCheckins: pending.slice(0, 3),
    focusList: [
      pending.length > 0 ? `Review ${pending.length} pending check-in${pending.length > 1 ? 's' : ''}` : null,
      patients.some(p => p.status === 'Needs attention') ? 'Follow up with patients needing attention' : null,
      patients.some(p => p.status === 'New') ? 'Welcome new patients' : null,
      'Update guidance notes for current program week'
    ].filter(Boolean)
  });
});

// ─── Patients ────────────────────────────────────────────────────────────────
app.get('/patients', async (req, res) => {
  if (!firestore) return res.json({ patients: [] });
  let patients = await getAll('patients');
  if (req.query.doctorId) patients = patients.filter(p => p.assignedDoctor === req.query.doctorId);
  res.json({ patients });
});

app.get('/patients/:id', async (req, res) => {
  if (!firestore) return res.status(404).json({ error: 'Not found' });
  const patient = await getDoc('patients', req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const checkins = (await getAll('checkins')).filter(c => c.coupleId === patient.id);
  const reports = (await getAll('reports')).filter(r => r.coupleId === patient.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const notes = (await getAll('notes')).filter(n => n.targetCoupleId === patient.id || !n.targetCoupleId);
  res.json({ patient, checkins, reports, notes });
});

// ─── Check-ins ───────────────────────────────────────────────────────────────
app.get('/checkins', async (req, res) => {
  if (!firestore) return res.json({ checkins: [] });
  const { status, doctorId } = req.query;
  let checkins = await getAll('checkins');
  if (doctorId) {
    const patients = await getAll('patients');
    const myPatientIds = patients.filter(p => p.assignedDoctor === doctorId).map(p => p.id);
    checkins = checkins.filter(c => myPatientIds.includes(c.coupleId));
  }
  if (status) checkins = checkins.filter(c => c.status === status);
  checkins.sort((a, b) => { if (a.status === 'pending' && b.status !== 'pending') return -1; if (a.status !== 'pending' && b.status === 'pending') return 1; return (b.submittedAt || '').localeCompare(a.submittedAt || ''); });
  res.json({ checkins });
});

app.post('/checkins', verifyFirebaseUser, async (req, res) => {
  const checkin = { coupleId: req.body.coupleId || 'couple_001', coupleName: req.body.name || req.body.coupleName || 'Priya & Arjun', week: req.body.week || 3, status: 'pending', summary: req.body.summary || 'Weekly check-in submitted.', details: req.body.details || {}, submittedAt: ts() };
  if (firestore) { const doc = await addDoc('checkins', checkin); io.emit('checkin:created', doc); return res.status(201).json(doc); }
  checkin.id = `ci_${Date.now()}`;
  io.emit('checkin:created', checkin);
  res.status(201).json(checkin);
});

app.post('/checkins/:id/respond', async (req, res) => {
  if (!firestore) return res.status(500).json({ error: 'Firestore not connected' });
  const checkin = await getDoc('checkins', req.params.id);
  if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
  const { body, doctorId } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Response body required' });
  const doctor = await getDoc('doctors', doctorId || 'dr_001') || { name: 'Doctor' };
  const response = { body: body.trim(), respondedBy: doctorId || 'dr_001', respondedByName: doctor.name, respondedAt: ts() };
  await updateDoc('checkins', req.params.id, { status: 'responded', response });
  const updated = { ...checkin, status: 'responded', response };
  io.emit('checkin:responded', updated);
  res.json({ checkin: updated });
});

// ─── Reports / Tracker Logs ─────────────────────────────────────────────────
app.get('/reports', async (req, res) => {
  if (!firestore) return res.json({ reports: [] });
  let reports = await getAll('reports');
  const { coupleId, from, to } = req.query;
  if (coupleId) reports = reports.filter(r => r.coupleId === coupleId);
  if (from) reports = reports.filter(r => r.date >= from);
  if (to) reports = reports.filter(r => r.date <= to);
  reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json({ reports });
});

app.post('/reports', verifyFirebaseUser, async (req, res) => {
  const report = { coupleId: req.body.coupleId || 'couple_001', coupleName: req.body.coupleName || 'Unknown', date: req.body.date || new Date().toISOString().slice(0, 10), energy: req.body.energy || 'Good', mood: req.body.mood || 'Good', sleep: req.body.sleep || 'Okay', mucus: req.body.mucus || 'Dry / None', symptoms: req.body.symptoms || [], notes: req.body.notes || '', createdAt: ts() };
  if (firestore) { const doc = await addDoc('reports', report); io.emit('report:created', doc); return res.status(201).json(doc); }
  report.id = `rpt_${Date.now()}`;
  io.emit('report:created', report);
  res.status(201).json(report);
});

// Backward compat alias for patient app
app.post('/tracker-logs', verifyFirebaseUser, async (req, res) => {
  const log = { coupleId: req.body.coupleId || 'couple_001', date: req.body.date || new Date().toISOString().slice(0, 10), energy: req.body.energy || 'Good', mood: req.body.mood || 'Calm', mucus: req.body.mucus || 'Watery', createdAt: ts() };
  if (firestore) { const doc = await addDoc('reports', log); io.emit('report:created', doc); return res.status(201).json(doc); }
  log.id = `log_${Date.now()}`;
  io.emit('report:created', log);
  res.status(201).json(log);
});

// ─── Notes ───────────────────────────────────────────────────────────────────
app.get('/notes', async (req, res) => {
  if (!firestore) return res.json({ notes: [] });
  let notes = await getAll('notes');
  const { doctorId, coupleId } = req.query;
  if (doctorId) notes = notes.filter(n => n.authorId === doctorId);
  if (coupleId) notes = notes.filter(n => n.targetCoupleId === coupleId || !n.targetCoupleId);
  notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json({ notes });
});

app.post('/notes', verifyFirebaseUser, async (req, res) => {
  const { title, body, tone, targetCoupleId, doctorId } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
  const doctor = firestore ? (await getDoc('doctors', doctorId || 'dr_001')) || { name: 'Doctor' } : { name: 'Doctor' };
  const note = { title: title.trim(), body: body.trim(), tone: tone || 'sage', targetCoupleId: targetCoupleId || null, authorId: doctorId || 'dr_001', authorName: doctor.name, createdAt: ts() };
  if (firestore) { const doc = await addDoc('notes', note); io.emit('note:created', doc); return res.status(201).json(doc); }
  note.id = `note_${Date.now()}`;
  io.emit('note:created', note);
  res.status(201).json(note);
});

app.delete('/notes/:id', async (req, res) => {
  if (!firestore) return res.status(404).json({ error: 'Not found' });
  const note = await getDoc('notes', req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  await deleteDoc('notes', req.params.id);
  io.emit('note:deleted', { id: req.params.id });
  res.json({ deleted: note });
});

// ─── Doctor Dashboard (legacy) ───────────────────────────────────────────────
app.get('/dashboard/doctor', verifyFirebaseUser, async (req, res) => {
  let patients = [], checkins = [];
  if (firestore) { patients = await getAll('patients'); checkins = await getAll('checkins'); }
  res.json({
    user: { id: 'dr_001', role: 'doctor', name: 'Dr. Divya K' },
    patients, checkins,
    stats: [{ label: 'Active couples', value: String(patients.length), tag: 'Total' }, { label: 'Pending reviews', value: String(checkins.filter(c => c.status === 'pending').length), tag: 'Today' }, { label: 'On track', value: patients.length ? Math.round(patients.filter(p => p.status === 'On track').length / patients.length * 100) + '%' : '0%', tag: 'Healthy' }],
    focus: ['Review pending check-ins', 'Update guidance notes']
  });
});

// Backward compat for patient app responses
app.post('/responses', verifyFirebaseUser, async (req, res) => {
  const { checkinId, body } = req.body;
  if (firestore && checkinId) {
    const checkin = await getDoc('checkins', checkinId);
    if (checkin) {
      const response = { body: body || 'Reviewed.', respondedBy: 'dr_001', respondedByName: 'Dr. Divya K', respondedAt: ts() };
      await updateDoc('checkins', checkinId, { status: 'responded', response });
      io.emit('checkin:responded', { ...checkin, status: 'responded', response });
    }
  }
  res.status(201).json({ id: `res_${Date.now()}`, checkinId, body, createdAt: ts() });
});

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(port, '0.0.0.0', () => {
  console.log(`🩺 LumiNest Unified API on http://0.0.0.0:${port}`);
  console.log(`🔌 WebSocket server ready on ws://0.0.0.0:${port}`);
  if (firestore) console.log('📦 Firestore connected — POST /seed to populate');
});
