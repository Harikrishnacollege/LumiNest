import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import C from '../colors';
import { fetchNotes, fetchPatients, createNote, deleteNote } from '../api';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function NotesScreen({ doctorId, showToast, socketOn, socketOff }) {
  const [notes, setNotes] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState('sage');
  const [target, setTarget] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([fetchNotes(doctorId), fetchPatients(doctorId)])
      .then(([n, p]) => { setNotes(n.notes); setPatients(p.patients); })
      .catch(() => showToast('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [doctorId]);

  useEffect(() => {
    const refresh = () => {
      fetchNotes(doctorId).then(n => setNotes(n.notes)).catch(() => {});
    };
    const events = ['note:created', 'note:deleted', 'data:seeded'];
    if (socketOn) events.forEach(e => socketOn(e, refresh));
    return () => { if (socketOff) events.forEach(e => socketOff(e, refresh)); };
  }, [socketOn, socketOff, doctorId]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { showToast('Title and body required'); return; }
    setCreating(true);
    try {
      await createNote({ title, body, tone, targetCoupleId: target, doctorId });
      showToast('Note created!');
      setTitle(''); setBody(''); setTarget(null);
      load();
    } catch { showToast('Failed to create'); }
    setCreating(false);
  };

  const remove = async (id) => {
    try { await deleteNote(id); showToast('Deleted'); load(); } catch { showToast('Failed'); }
  };

  if (loading) return <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={C.sage} /></View>;

  const toneColor = { sage: C.sage, gold: C.gold, blush: C.blush };

  return (
    <View>
      <View style={s.hdr}><Text style={s.title}>Notes & Guidance</Text><Text style={s.sub}>Create notes for your patients</Text></View>

      <View style={s.form}>
        <Text style={s.formTitle}>✍️ New Note</Text>
        <TextInput style={s.input} placeholder="Title" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} />
        <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Write guidance..." placeholderTextColor={C.muted} multiline value={body} onChangeText={setBody} />
        <Text style={s.label}>Tone</Text>
        <View style={s.toneRow}>
          {['sage', 'gold', 'blush'].map(t => (
            <Pressable key={t} style={[s.toneBtn, tone === t && { backgroundColor: toneColor[t], borderColor: toneColor[t] }]} onPress={() => setTone(t)}>
              <Text style={[s.toneText, tone === t && { color: '#fff' }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>Target Patient</Text>
        <View style={s.toneRow}>
          <Pressable style={[s.toneBtn, !target && s.toneBtnActive]} onPress={() => setTarget(null)}>
            <Text style={[s.toneText, !target && { color: '#fff' }]}>All</Text>
          </Pressable>
          {patients.map(p => (
            <Pressable key={p.id} style={[s.toneBtn, target === p.id && s.toneBtnActive]} onPress={() => setTarget(p.id)}>
              <Text style={[s.toneText, target === p.id && { color: '#fff' }]}>{p.name.split(' & ')[0]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[s.btn, creating && { opacity: 0.6 }]} onPress={submit} disabled={creating}>
          <Text style={s.btnText}>{creating ? 'Creating...' : 'Create Note'}</Text>
        </Pressable>
      </View>

      {notes.map(n => {
        const tc = toneColor[n.tone] || C.sage;
        const targetName = n.targetCoupleId ? patients.find(p => p.id === n.targetCoupleId)?.name : null;
        return (
          <View key={n.id} style={[s.noteCard, { borderLeftColor: tc }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={s.noteTitle}>{n.title}</Text>
              <Pressable onPress={() => remove(n.id)} style={s.delBtn}><Ionicons name="trash-outline" size={16} color={C.dangerText} /></Pressable>
            </View>
            <Text style={s.noteBody}>{n.body}</Text>
            <View style={s.noteFooter}>
              <Text style={s.noteAuthor}>{n.authorName} · {fmtDate(n.createdAt)}</Text>
              <View style={s.noteTarget}><Text style={s.noteTargetText}>{targetName ? `→ ${targetName}` : 'All patients'}</Text></View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.charcoal },
  sub: { color: C.mid, fontSize: 13 },
  form: { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  formTitle: { fontSize: 15, fontWeight: '800', color: C.charcoal, marginBottom: 12 },
  input: { backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.charcoal, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '800', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  toneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  toneBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.cream },
  toneBtnActive: { backgroundColor: C.sage, borderColor: C.sage },
  toneText: { fontSize: 12, fontWeight: '700', color: C.mid },
  btn: { backgroundColor: C.sage, borderRadius: 24, padding: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  noteCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderRadius: 14, padding: 14 },
  noteTitle: { fontWeight: '800', fontSize: 14, color: C.charcoal, flex: 1 },
  noteBody: { fontSize: 13, color: C.charcoal, lineHeight: 20, marginTop: 4 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  noteAuthor: { fontSize: 11, color: C.mid },
  noteTarget: { backgroundColor: C.sagePale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  noteTargetText: { fontSize: 10, fontWeight: '700', color: C.sage },
  delBtn: { padding: 4 },
});
