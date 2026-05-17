import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import C from '../colors';
import { fetchReports, fetchPatients } from '../api';

const metricColor = (v) => {
  if (['Good', 'Great', 'High', 'Excellent', 'Egg-white (stretchy)', 'Watery'].includes(v)) return { bg: C.sagePale, fg: C.sage };
  if (['Low', 'Poor', 'Struggling'].includes(v)) return { bg: C.dangerBg, fg: C.dangerText };
  return { bg: C.cream, fg: C.charcoal };
};

export default function ReportsScreen({ doctorId, showToast, socketOn, socketOff }) {
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchReports(), fetchPatients(doctorId)])
      .then(([r, p]) => { setReports(r.reports); setPatients(p.patients); })
      .catch(() => showToast('Failed to load'))
      .finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    const refresh = () => {
      fetchReports(filter ? { coupleId: filter } : {}).then(r => setReports(r.reports)).catch(() => {});
    };
    const events = ['report:created', 'data:seeded'];
    if (socketOn) events.forEach(e => socketOn(e, refresh));
    return () => { if (socketOff) events.forEach(e => socketOff(e, refresh)); };
  }, [socketOn, socketOff, doctorId, filter]);

  const applyFilter = (coupleId) => {
    setFilter(coupleId);
    setLoading(true);
    fetchReports(coupleId ? { coupleId } : {})
      .then(r => setReports(r.reports))
      .catch(() => showToast('Failed'))
      .finally(() => setLoading(false));
  };

  if (loading) return <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={C.sage} /></View>;

  return (
    <View>
      <View style={s.hdr}><Text style={s.title}>Reports</Text><Text style={s.sub}>Daily tracker logs from patients</Text></View>

      <View style={s.filters}>
        <Pressable style={[s.filterBtn, !filter && s.filterActive]} onPress={() => applyFilter(null)}>
          <Text style={[s.filterText, !filter && s.filterTextActive]}>All</Text>
        </Pressable>
        {patients.map(p => (
          <Pressable key={p.id} style={[s.filterBtn, filter === p.id && s.filterActive]} onPress={() => applyFilter(p.id)}>
            <Text style={[s.filterText, filter === p.id && s.filterTextActive]}>{p.name.split(' & ')[0]}</Text>
          </Pressable>
        ))}
      </View>

      {reports.map(r => (
        <View key={r.id} style={s.card}>
          <View style={s.cardHead}><Text style={s.couple}>{r.coupleName}</Text><Text style={s.date}>{r.date}</Text></View>
          <View style={s.metrics}>
            {[['⚡', r.energy], ['🌈', r.mood], ['💤', r.sleep], ['🌺', r.mucus]].map(([emoji, val]) => {
              const mc = metricColor(val);
              return <View key={emoji} style={[s.pill, { backgroundColor: mc.bg }]}><Text style={[s.pillText, { color: mc.fg }]}>{emoji} {val}</Text></View>;
            })}
          </View>
          {r.symptoms?.length > 0 && (
            <View style={s.symptoms}>
              {r.symptoms.map(sy => <View key={sy} style={s.symptomTag}><Text style={s.symptomText}>{sy}</Text></View>)}
            </View>
          )}
          {r.notes ? <Text style={s.notes}>"{r.notes}"</Text> : null}
        </View>
      ))}
      {!reports.length && <Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>No reports match filters</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.charcoal },
  sub: { color: C.mid, fontSize: 13 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.warm },
  filterActive: { backgroundColor: C.sage, borderColor: C.sage },
  filterText: { fontSize: 12, fontWeight: '700', color: C.mid },
  filterTextActive: { color: '#fff' },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  couple: { fontWeight: '700', fontSize: 14, color: C.charcoal },
  date: { color: C.mid, fontSize: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, overflow: 'hidden' },
  pillText: { fontSize: 11, fontWeight: '600' },
  symptoms: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  symptomTag: { backgroundColor: C.blushPale, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  symptomText: { fontSize: 10, fontWeight: '700', color: C.blush },
  notes: { color: C.mid, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
});
