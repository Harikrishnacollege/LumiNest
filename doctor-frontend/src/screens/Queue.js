import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import C from '../colors';
import { fetchCheckins, respondCheckin } from '../api';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function QueueScreen({ doctorId, showToast, socketOn, socketOff }) {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState({});
  const [sending, setSending] = useState(null);

  const load = () => {
    setLoading(true);
    fetchCheckins(doctorId).then(d => setCheckins(d.checkins)).catch(() => showToast('Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [doctorId]);

  useEffect(() => {
    const refresh = () => fetchCheckins(doctorId).then(d => setCheckins(d.checkins)).catch(() => {});
    const events = ['checkin:created', 'checkin:responded', 'data:seeded'];
    if (socketOn) events.forEach(e => socketOn(e, refresh));
    return () => { if (socketOff) events.forEach(e => socketOff(e, refresh)); };
  }, [socketOn, socketOff, doctorId]);

  const send = async (id) => {
    const body = responses[id];
    if (!body?.trim()) { showToast('Please write a response'); return; }
    setSending(id);
    try {
      await respondCheckin(id, body, doctorId);
      showToast('Response sent!');
      setResponses(r => ({ ...r, [id]: '' }));
      load();
    } catch { showToast('Failed to send'); }
    setSending(null);
  };

  if (loading) return <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={C.sage} /></View>;

  const pending = checkins.filter(c => c.status === 'pending');
  const responded = checkins.filter(c => c.status === 'responded');

  return (
    <View>
      <View style={s.hdr}><Text style={s.title}>Review Queue</Text><Text style={s.sub}>{pending.length} pending check-in{pending.length !== 1 ? 's' : ''}</Text></View>

      {pending.length > 0 && <Text style={s.section}>PENDING ({pending.length})</Text>}
      {pending.map(c => (
        <View key={c.id} style={[s.card, s.pendingBorder]}>
          <View style={s.cardHead}>
            <Text style={s.couple}>{c.coupleName} <Text style={s.meta}>· Week {c.week} · {fmtDate(c.submittedAt)}</Text></Text>
            <View style={[s.badge, { backgroundColor: C.warnBg }]}><Text style={[s.badgeText, { color: C.warnText }]}>Pending</Text></View>
          </View>
          <View style={s.summaryBox}><Text style={s.summaryText}>{c.summary}</Text></View>
          {c.details && (
            <View style={s.details}>
              {[['Health', c.details.health], ['Improved', c.details.improved], ['Worsened', c.details.worsened], ['Cycle', c.details.cycleObs], ['Emotional', c.details.emotional]].filter(([,v]) => v).map(([l, v]) => (
                <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={s.detailVal}>{v}</Text></View>
              ))}
              {c.details.question && <View style={[s.detailItem, { borderLeftWidth: 3, borderLeftColor: C.sage, paddingLeft: 10 }]}><Text style={s.detailLabel}>Patient's Question</Text><Text style={[s.detailVal, { color: C.sage, fontWeight: '700' }]}>{c.details.question}</Text></View>}
            </View>
          )}
          <TextInput style={s.input} placeholder={`Write your response to ${c.coupleName}...`} placeholderTextColor={C.muted} multiline value={responses[c.id] || ''} onChangeText={t => setResponses(r => ({ ...r, [c.id]: t }))} />
          <Pressable style={[s.btn, sending === c.id && { opacity: 0.6 }]} onPress={() => send(c.id)} disabled={sending === c.id}>
            <Text style={s.btnText}>{sending === c.id ? 'Sending...' : 'Send Response'}</Text>
          </Pressable>
        </View>
      ))}

      {responded.length > 0 && <Text style={s.section}>RESPONDED ({responded.length})</Text>}
      {responded.map(c => (
        <View key={c.id} style={[s.card, s.respondedBorder]}>
          <View style={s.cardHead}>
            <Text style={s.couple}>{c.coupleName} <Text style={s.meta}>· Week {c.week} · {fmtDate(c.submittedAt)}</Text></Text>
            <View style={[s.badge, { backgroundColor: C.sagePale }]}><Text style={[s.badgeText, { color: C.sage }]}>Responded</Text></View>
          </View>
          <View style={s.summaryBox}><Text style={s.summaryText}>{c.summary}</Text></View>
          {c.response && (
            <View style={s.responseBox}>
              <Text style={s.responseText}>{c.response.body}</Text>
              <Text style={s.responseBy}>— {c.response.respondedByName || 'Doctor'} · {fmtDate(c.response.respondedAt)}</Text>
            </View>
          )}
        </View>
      ))}

      {!checkins.length && <Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>No check-ins yet</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.charcoal },
  sub: { color: C.mid, fontSize: 13 },
  section: { paddingHorizontal: 16, fontSize: 11, fontWeight: '800', color: C.mid, letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  pendingBorder: { borderLeftWidth: 4, borderLeftColor: C.gold },
  respondedBorder: { borderLeftWidth: 4, borderLeftColor: C.sage },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  couple: { fontWeight: '800', fontSize: 15, color: C.charcoal, flex: 1 },
  meta: { fontWeight: '400', fontSize: 12, color: C.mid },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  summaryBox: { backgroundColor: C.cream, borderRadius: 10, padding: 12, marginBottom: 10 },
  summaryText: { fontSize: 13, color: C.charcoal, lineHeight: 20 },
  details: { gap: 8, marginBottom: 10 },
  detailItem: { gap: 2 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailVal: { fontSize: 13, color: C.charcoal, lineHeight: 19 },
  input: { backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12, minHeight: 70, textAlignVertical: 'top', fontSize: 14, color: C.charcoal, marginBottom: 8 },
  btn: { backgroundColor: C.sage, borderRadius: 24, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  responseBox: { backgroundColor: C.sagePale, borderRadius: 10, padding: 14, marginTop: 4 },
  responseText: { fontSize: 13, color: C.charcoal, lineHeight: 20 },
  responseBy: { fontSize: 11, color: C.sage, fontWeight: '700', marginTop: 8 },
});
