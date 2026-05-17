import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import C from '../colors';
import { fetchDashboard } from '../api';

export default function DashboardScreen({ doctorId, showToast, onNav, socketOn, socketOff }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDashboard(doctorId).then(setData).catch(() => showToast('Failed to load dashboard')).finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    const refresh = () => fetchDashboard(doctorId).then(setData).catch(() => {});
    const events = ['checkin:created', 'checkin:responded', 'report:created', 'data:seeded'];
    if (socketOn) events.forEach(e => socketOn(e, refresh));
    return () => { if (socketOff) events.forEach(e => socketOff(e, refresh)); };
  }, [socketOn, socketOff, doctorId]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.sage} /></View>;
  if (!data) return <Text style={s.error}>Could not connect to server</Text>;

  const st = data.stats;
  return (
    <View>
      <View style={s.header}>
        <Text style={s.headerEye}>Doctor Dashboard ✦</Text>
        <Text style={s.headerTitle}>Care-team priorities</Text>
        <Text style={s.headerPill}>Today's overview</Text>
      </View>

      <View style={s.statsRow}>
        {[
          { v: st.totalPatients, l: 'Active Couples', t: 'Your patients', c: null },
          { v: st.pendingReviews, l: 'Pending Reviews', t: st.pendingReviews > 0 ? 'Needs attention' : 'All clear', c: st.pendingReviews > 0 ? C.blush : C.sage },
          { v: `${st.onTrackPercent}%`, l: 'On Track', t: 'Healthy', c: C.sage },
          { v: st.activeLoggers, l: 'Active Loggers', t: 'This week', c: null },
        ].map((s2, i) => (
          <View key={i} style={s.statCard}>
            <Text style={[s.statVal, s2.c && { color: s2.c }]}>{s2.v}</Text>
            <Text style={s.statLabel}>{s2.l}</Text>
            <Text style={s.statTag}>{s2.t}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Focus List</Text>
        {data.focusList.map((f, i) => (
          <View key={i} style={s.focusItem}>
            <View style={s.focusDot} />
            <Text style={s.focusText}>{f}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Recent Check-ins</Text>
        {data.recentCheckins.length ? data.recentCheckins.map((c, i) => (
          <View key={i} style={s.focusItem}>
            <View style={[s.badge, s.badgePending]}><Text style={s.badgeText}>Pending</Text></View>
            <Text style={s.focusText}><Text style={{ fontWeight: '800' }}>{c.coupleName}</Text> — Week {c.week}</Text>
          </View>
        )) : <Text style={s.sub}>No pending check-ins 🎉</Text>}
        {data.recentCheckins.length > 0 && (
          <Pressable style={s.linkBtn} onPress={() => onNav('queue')}>
            <Text style={s.linkText}>View all →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  error: { color: C.mid, textAlign: 'center', marginTop: 40, fontSize: 14 },
  header: { margin: 16, padding: 20, borderRadius: 18, backgroundColor: C.sageDark },
  headerEye: { color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  headerPill: { alignSelf: 'flex-start', marginTop: 10, color: '#fff', backgroundColor: 'rgba(255,255,255,.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  statVal: { fontSize: 26, fontWeight: '900', color: C.charcoal },
  statLabel: { color: C.mid, fontSize: 11, marginTop: 2 },
  statTag: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: C.sagePale, color: C.sage, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.charcoal, marginBottom: 10 },
  focusItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  focusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.sage },
  focusText: { flex: 1, fontSize: 13, color: C.charcoal },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
  badgePending: { backgroundColor: C.warnBg },
  badgeText: { fontSize: 10, fontWeight: '800', color: C.warnText },
  sub: { color: C.mid, fontSize: 13 },
  linkBtn: { marginTop: 8 },
  linkText: { color: C.sage, fontWeight: '700', fontSize: 13 },
});
