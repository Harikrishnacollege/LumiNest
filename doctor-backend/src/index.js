require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── In-Memory Database ─────────────────────────────────────────────────────
// Shared state that mirrors what the patient app produces.
// In production, this would be Firestore reads/writes.

const db = {
  doctors: [
    {
      id: 'dr_001',
      name: 'Dr. Divya K',
      email: 'divya@luminest.care',
      avatar: 'DK',
      specialty: 'Reproductive Endocrinology',
      bio: 'Specialist in fertility care with 12+ years of experience in holistic reproductive health.'
    },
    {
      id: 'dr_002',
      name: 'Dr. Praveen',
      email: 'praveen@luminest.care',
      avatar: 'PR',
      specialty: 'Fertility & Lifestyle Medicine',
      bio: 'Focused on integrative approaches to fertility — nutrition, movement, and cycle optimization.'
    }
  ],

  patients: [
    {
      id: 'couple_001',
      name: 'Priya & Arjun',
      email: 'priya.arjun@email.com',
      package: 'Sprout',
      week: 3,
      cycleDay: 13,
      status: 'On track',
      concern: 'Irregular cycles',
      tryingSince: '8 months',
      assignedDoctor: 'dr_001',
      joinedAt: '2026-04-28T10:00:00Z'
    },
    {
      id: 'couple_002',
      name: 'Meera & Kiran',
      email: 'meera.kiran@email.com',
      package: 'Bloom',
      week: 5,
      cycleDay: 8,
      status: 'Needs attention',
      concern: 'Low energy',
      tryingSince: '1 year',
      assignedDoctor: 'dr_001',
      joinedAt: '2026-04-14T10:00:00Z'
    },
    {
      id: 'couple_003',
      name: 'Anika & Rohan',
      email: 'anika.rohan@email.com',
      package: 'Seed',
      week: 2,
      cycleDay: 20,
      status: 'New check-in',
      concern: 'Cycle awareness',
      tryingSince: '4 months',
      assignedDoctor: 'dr_002',
      joinedAt: '2026-05-05T10:00:00Z'
    },
    {
      id: 'couple_004',
      name: 'Sneha & Vikram',
      email: 'sneha.vikram@email.com',
      package: 'Bloom',
      week: 6,
      cycleDay: 15,
      status: 'On track',
      concern: 'Timing optimization',
      tryingSince: '6 months',
      assignedDoctor: 'dr_002',
      joinedAt: '2026-04-07T10:00:00Z'
    },
    {
      id: 'couple_005',
      name: 'Ritu & Deepak',
      email: 'ritu.deepak@email.com',
      package: 'Sprout',
      week: 1,
      cycleDay: 3,
      status: 'New',
      concern: 'Getting started',
      tryingSince: '3 months',
      assignedDoctor: 'dr_001',
      joinedAt: '2026-05-12T10:00:00Z'
    }
  ],

  checkins: [
    {
      id: 'ci_001',
      coupleId: 'couple_001',
      coupleName: 'Priya & Arjun',
      week: 3,
      status: 'pending',
      summary: 'Energy is steady. Cervical mucus changed to watery yesterday. Asking if timing is right.',
      details: {
        health: 'Energy has improved since last week. Sleeping 7-8 hours consistently.',
        improved: 'Sleep quality, energy levels in the morning.',
        worsened: 'Mild bloating in the evenings.',
        cycleObs: 'CM changed from creamy to watery on Day 12. Slight ovulation pain on left side.',
        emotional: 'Good',
        question: 'Is the watery CM a good sign for fertile window timing?'
      },
      submittedAt: '2026-05-16T08:30:00Z'
    },
    {
      id: 'ci_002',
      coupleId: 'couple_002',
      coupleName: 'Meera & Kiran',
      week: 5,
      status: 'pending',
      summary: 'Stress is high this week and sleep dropped to 5 hours.',
      details: {
        health: 'Work stress peaked this week. Headaches returned.',
        improved: 'Diet is consistent with plan.',
        worsened: 'Sleep dropped to 5 hours on 3 nights. Headaches.',
        cycleObs: 'Cycle appears regular but CM is minimal.',
        emotional: 'Struggling',
        question: 'Should I take a break from tracking when stressed?'
      },
      submittedAt: '2026-05-15T19:45:00Z'
    },
    {
      id: 'ci_003',
      coupleId: 'couple_003',
      coupleName: 'Anika & Rohan',
      week: 2,
      status: 'pending',
      summary: 'Completed daily food and movement tasks for six days.',
      details: {
        health: 'Feeling good overall. Started morning walks.',
        improved: 'Consistency with food logging and movement.',
        worsened: 'Nothing specific.',
        cycleObs: 'Learning to identify CM types. Currently in luteal phase.',
        emotional: 'Good',
        question: 'How long before I can expect clearer CM patterns?'
      },
      submittedAt: '2026-05-16T14:20:00Z'
    },
    {
      id: 'ci_004',
      coupleId: 'couple_004',
      coupleName: 'Sneha & Vikram',
      week: 6,
      status: 'responded',
      summary: 'Egg-white CM observed on Day 13 and 14. BBT shift confirmed.',
      details: {
        health: 'Great week. Energy and sleep are stable.',
        improved: 'CM tracking confidence. BBT pattern is clear.',
        worsened: 'Nothing.',
        cycleObs: 'EWCM on Day 13-14, BBT rose by 0.3°C on Day 15.',
        emotional: 'Excellent',
        question: 'Is the BBT shift enough to confirm ovulation?'
      },
      submittedAt: '2026-05-14T09:00:00Z',
      response: {
        body: 'Excellent observations! The BBT shift of 0.3°C sustained for 3+ days, combined with EWCM, strongly suggests ovulation occurred. Keep tracking for the rest of this cycle to build your baseline.',
        respondedBy: 'dr_002',
        respondedAt: '2026-05-14T16:30:00Z'
      }
    },
    {
      id: 'ci_005',
      coupleId: 'couple_001',
      coupleName: 'Priya & Arjun',
      week: 2,
      status: 'responded',
      summary: 'Started tracking CM for the first time. Sleep has improved with evening routine.',
      details: {
        health: 'Good energy. Started evening wind-down routine.',
        improved: 'Sleep onset time reduced from 45 min to 20 min.',
        worsened: 'Mild cramps during period days.',
        cycleObs: 'Period ended Day 5. CM currently dry/sticky.',
        emotional: 'Good',
        question: 'When should I expect CM to change to creamy?'
      },
      submittedAt: '2026-05-09T10:15:00Z',
      response: {
        body: 'Great progress on your sleep routine! CM typically transitions from dry → sticky → creamy around Days 8-10. Keep observing — you are building a valuable baseline.',
        respondedBy: 'dr_001',
        respondedAt: '2026-05-09T17:00:00Z'
      }
    }
  ],

  reports: [
    {
      id: 'rpt_001',
      coupleId: 'couple_001',
      coupleName: 'Priya & Arjun',
      date: '2026-05-16',
      energy: 'Good',
      mood: 'Good',
      sleep: 'Good',
      mucus: 'Watery',
      symptoms: ['Breast tenderness'],
      notes: 'Noticed watery CM today. Feeling positive.',
      createdAt: '2026-05-16T07:30:00Z'
    },
    {
      id: 'rpt_002',
      coupleId: 'couple_001',
      coupleName: 'Priya & Arjun',
      date: '2026-05-15',
      energy: 'Good',
      mood: 'Good',
      sleep: 'Okay',
      mucus: 'Creamy / Lotion-like',
      symptoms: [],
      notes: 'Steady day. Walked 30 min.',
      createdAt: '2026-05-15T08:00:00Z'
    },
    {
      id: 'rpt_003',
      coupleId: 'couple_002',
      coupleName: 'Meera & Kiran',
      date: '2026-05-16',
      energy: 'Low',
      mood: 'Low',
      sleep: 'Poor',
      mucus: 'Dry / None',
      symptoms: ['Headache', 'Bloating'],
      notes: 'Bad night. Headache since morning. Work deadline stress.',
      createdAt: '2026-05-16T09:00:00Z'
    },
    {
      id: 'rpt_004',
      coupleId: 'couple_003',
      coupleName: 'Anika & Rohan',
      date: '2026-05-16',
      energy: 'High',
      mood: 'Great',
      sleep: 'Great',
      mucus: 'Sticky',
      symptoms: [],
      notes: 'Morning walk and healthy breakfast. Feeling great!',
      createdAt: '2026-05-16T06:45:00Z'
    },
    {
      id: 'rpt_005',
      coupleId: 'couple_004',
      coupleName: 'Sneha & Vikram',
      date: '2026-05-16',
      energy: 'Good',
      mood: 'Good',
      sleep: 'Good',
      mucus: 'Egg-white (stretchy)',
      symptoms: ['Cramps'],
      notes: 'EWCM observed. Mild ovulation cramps.',
      createdAt: '2026-05-16T07:15:00Z'
    },
    {
      id: 'rpt_006',
      coupleId: 'couple_001',
      coupleName: 'Priya & Arjun',
      date: '2026-05-14',
      energy: 'Okay',
      mood: 'Neutral',
      sleep: 'Good',
      mucus: 'Creamy / Lotion-like',
      symptoms: [],
      notes: 'Regular day.',
      createdAt: '2026-05-14T08:30:00Z'
    },
    {
      id: 'rpt_007',
      coupleId: 'couple_002',
      coupleName: 'Meera & Kiran',
      date: '2026-05-15',
      energy: 'Okay',
      mood: 'Neutral',
      sleep: 'Okay',
      mucus: 'Dry / None',
      symptoms: ['Bloating'],
      notes: 'Ate well but energy is flat.',
      createdAt: '2026-05-15T08:30:00Z'
    },
    {
      id: 'rpt_008',
      coupleId: 'couple_004',
      coupleName: 'Sneha & Vikram',
      date: '2026-05-15',
      energy: 'Good',
      mood: 'Good',
      sleep: 'Great',
      mucus: 'Watery',
      symptoms: [],
      notes: 'CM changing to watery. Feeling good.',
      createdAt: '2026-05-15T07:00:00Z'
    }
  ],

  notes: [
    {
      id: 'note_001',
      title: 'Week 3 guidance',
      body: 'You are approaching your fertile window. Keep tracking mucus changes and prioritize sleep for the next few nights.',
      tone: 'sage',
      targetCoupleId: 'couple_001',
      authorId: 'dr_001',
      authorName: 'Dr. Divya K',
      createdAt: '2026-05-15T10:00:00Z'
    },
    {
      id: 'note_002',
      title: 'Nutrition focus',
      body: 'Add one protein-rich snack in the evening to keep energy stable.',
      tone: 'gold',
      targetCoupleId: null,
      authorId: 'dr_001',
      authorName: 'Dr. Divya K',
      createdAt: '2026-05-14T11:00:00Z'
    },
    {
      id: 'note_003',
      title: 'Sleep protocol for stress weeks',
      body: 'When stress is high: no screens 1 hour before bed, chamomile tea, 10 min guided breathing. This is especially important during your fertile window.',
      tone: 'sage',
      targetCoupleId: 'couple_002',
      authorId: 'dr_001',
      authorName: 'Dr. Divya K',
      createdAt: '2026-05-13T09:00:00Z'
    },
    {
      id: 'note_004',
      title: 'CM tracking beginner tips',
      body: 'Check CM at the same time each day, ideally after your first bathroom visit. Note both the appearance and the sensation (dry, wet, slippery).',
      tone: 'sage',
      targetCoupleId: 'couple_003',
      authorId: 'dr_002',
      authorName: 'Dr. Praveen',
      createdAt: '2026-05-12T15:00:00Z'
    }
  ]
};

// ─── Helper ──────────────────────────────────────────────────────────────────
const timestamp = () => new Date().toISOString();

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luminest-doctor-api', timestamp: timestamp() });
});

// ─── Doctors ─────────────────────────────────────────────────────────────────
app.get('/doctors', (_req, res) => {
  res.json({ doctors: db.doctors });
});

app.get('/doctors/:id', (req, res) => {
  const doctor = db.doctors.find((d) => d.id === req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ doctor });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
  const doctorId = req.query.doctorId || null;

  const relevantPatients = doctorId
    ? db.patients.filter((p) => p.assignedDoctor === doctorId)
    : db.patients;

  const relevantCheckins = doctorId
    ? db.checkins.filter((c) => {
        const patient = db.patients.find((p) => p.id === c.coupleId);
        return patient && patient.assignedDoctor === doctorId;
      })
    : db.checkins;

  const pendingCheckins = relevantCheckins.filter((c) => c.status === 'pending');
  const onTrack = relevantPatients.filter((p) => p.status === 'On track').length;
  const onTrackPercent = relevantPatients.length > 0
    ? Math.round((onTrack / relevantPatients.length) * 100)
    : 0;

  // Recent reports (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentReports = db.reports.filter((r) => r.date >= weekAgo);
  const patientsWithReports = new Set(recentReports.map((r) => r.coupleId));
  const activeLoggers = patientsWithReports.size;

  res.json({
    stats: {
      totalPatients: relevantPatients.length,
      pendingReviews: pendingCheckins.length,
      onTrackPercent,
      activeLoggers,
      totalCheckins: relevantCheckins.length,
      respondedThisWeek: relevantCheckins.filter((c) => c.status === 'responded' && c.response?.respondedAt >= weekAgo).length
    },
    recentCheckins: pendingCheckins.slice(0, 3),
    recentReports: recentReports.slice(0, 5),
    focusList: [
      pendingCheckins.length > 0 ? `Review ${pendingCheckins.length} pending check-in${pendingCheckins.length > 1 ? 's' : ''}` : null,
      relevantPatients.some((p) => p.status === 'Needs attention') ? 'Follow up with patients needing attention' : null,
      relevantPatients.some((p) => p.status === 'New') ? 'Welcome new patients' : null,
      'Update guidance notes for current program week'
    ].filter(Boolean)
  });
});

// ─── Patients ────────────────────────────────────────────────────────────────
app.get('/patients', (req, res) => {
  const doctorId = req.query.doctorId || null;
  const patients = doctorId
    ? db.patients.filter((p) => p.assignedDoctor === doctorId)
    : db.patients;
  res.json({ patients });
});

app.get('/patients/:id', (req, res) => {
  const patient = db.patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const patientCheckins = db.checkins.filter((c) => c.coupleId === patient.id);
  const patientReports = db.reports.filter((r) => r.coupleId === patient.id);
  const patientNotes = db.notes.filter((n) => n.targetCoupleId === patient.id || n.targetCoupleId === null);

  res.json({
    patient,
    checkins: patientCheckins,
    reports: patientReports.sort((a, b) => b.date.localeCompare(a.date)),
    notes: patientNotes
  });
});

// ─── Check-ins ───────────────────────────────────────────────────────────────
app.get('/checkins', (req, res) => {
  const { status, doctorId } = req.query;
  let checkins = [...db.checkins];

  if (doctorId) {
    checkins = checkins.filter((c) => {
      const patient = db.patients.find((p) => p.id === c.coupleId);
      return patient && patient.assignedDoctor === doctorId;
    });
  }

  if (status) {
    checkins = checkins.filter((c) => c.status === status);
  }

  // Sort: pending first, then by submitted date descending
  checkins.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return (b.submittedAt || '').localeCompare(a.submittedAt || '');
  });

  res.json({ checkins });
});

app.get('/checkins/:id', (req, res) => {
  const checkin = db.checkins.find((c) => c.id === req.params.id);
  if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
  res.json({ checkin });
});

app.post('/checkins/:id/respond', (req, res) => {
  const checkin = db.checkins.find((c) => c.id === req.params.id);
  if (!checkin) return res.status(404).json({ error: 'Check-in not found' });

  const { body, doctorId } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Response body is required' });
  }

  const doctor = db.doctors.find((d) => d.id === doctorId) || db.doctors[0];

  checkin.status = 'responded';
  checkin.response = {
    body: body.trim(),
    respondedBy: doctor.id,
    respondedByName: doctor.name,
    respondedAt: timestamp()
  };

  res.json({ checkin });
});

// ─── Reports (Daily Logs) ────────────────────────────────────────────────────
app.get('/reports', (req, res) => {
  const { coupleId, from, to } = req.query;
  let reports = [...db.reports];

  if (coupleId) {
    reports = reports.filter((r) => r.coupleId === coupleId);
  }

  if (from) {
    reports = reports.filter((r) => r.date >= from);
  }

  if (to) {
    reports = reports.filter((r) => r.date <= to);
  }

  reports.sort((a, b) => b.date.localeCompare(a.date));

  res.json({ reports });
});

app.get('/reports/:id', (req, res) => {
  const report = db.reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ report });
});

// Endpoint for patient app to submit a daily report
app.post('/reports', (req, res) => {
  const report = {
    id: `rpt_${Date.now()}`,
    coupleId: req.body.coupleId || 'couple_001',
    coupleName: req.body.coupleName || 'Unknown',
    date: req.body.date || new Date().toISOString().slice(0, 10),
    energy: req.body.energy || 'Good',
    mood: req.body.mood || 'Good',
    sleep: req.body.sleep || 'Okay',
    mucus: req.body.mucus || 'Dry / None',
    symptoms: req.body.symptoms || [],
    notes: req.body.notes || '',
    createdAt: timestamp()
  };

  db.reports.unshift(report);
  res.status(201).json({ report });
});

// ─── Notes / Guidance ────────────────────────────────────────────────────────
app.get('/notes', (req, res) => {
  const { doctorId, coupleId } = req.query;
  let notes = [...db.notes];

  if (doctorId) {
    notes = notes.filter((n) => n.authorId === doctorId);
  }

  if (coupleId) {
    notes = notes.filter((n) => n.targetCoupleId === coupleId || n.targetCoupleId === null);
  }

  notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  res.json({ notes });
});

app.post('/notes', (req, res) => {
  const { title, body, tone, targetCoupleId, doctorId } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const doctor = db.doctors.find((d) => d.id === doctorId) || db.doctors[0];

  const note = {
    id: `note_${Date.now()}`,
    title: title.trim(),
    body: body.trim(),
    tone: tone || 'sage',
    targetCoupleId: targetCoupleId || null,
    authorId: doctor.id,
    authorName: doctor.name,
    createdAt: timestamp()
  };

  db.notes.unshift(note);
  res.status(201).json({ note });
});

app.delete('/notes/:id', (req, res) => {
  const index = db.notes.findIndex((n) => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Note not found' });
  const deleted = db.notes.splice(index, 1)[0];
  res.json({ deleted });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', () => {
  console.log(`🩺 LumiNest Doctor API listening on http://0.0.0.0:${port}`);
});
