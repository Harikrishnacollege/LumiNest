import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import C from '../colors';
import { fetchPatients, fetchPatientDetail } from '../api';

const initials = (n) => n.split(/[& ]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const statusStyle = (st) => {
  if (st === 'On track') return { bg: C.sagePale, fg: C.sage };
  if (st === 'Needs attention') return { bg: C.warnBg, fg: C.warnText };
  return { bg: C.newBg, fg: C.newText };
};

export default function PatientsScreen({ doctorId, showToast, socketOn, socketOff }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchPatients(doctorId).then(d => setPatients(d.patients)).catch(() => showToast('Failed to load')).finally(() => setLoading(false));
  }, [doctorId]);

  useEffect(() => {
    const refresh = () => {
      fetchPatients(doctorId).then(d => setPatients(d.patients)).catch(() => {});
      if (detail?.patient?.id) {
        fetchPatientDetail(detail.patient.id).then(setDetail).catch(() => {});
      }
    };
    const events = ['checkin:created', 'checkin:responded', 'report:created', 'data:seeded'];
    if (socketOn) events.forEach(e => socketOn(e, refresh));
    return () => { if (socketOff) events.forEach(e => socketOff(e, refresh)); };
  }, [socketOn, socketOff, doctorId, detail?.patient?.id]);

  const openDetail = async (id) => {
    try {
      const d = await fetchPatientDetail(id);
      setDetail(d);
    } catch { showToast('Failed to load detail'); }
  };

  if (loading) return <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator size="large" color={C.sage} /></View>;

  return (
    <View>
      <View style={s.hdr}><Text style={s.title}>Patients</Text><Text style={s.sub}>{patients.length} couple{patients.length !== 1 ? 's' : ''} in your care</Text></View>
      {patients.map(p => {
        const st = statusStyle(p.status);
        return (
          <Pressable key={p.id} style={s.row} onPress={() => openDetail(p.id)}>
            <View style={s.av}><Text style={s.avText}>{initials(p.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.meta}>{p.package} · Week {p.week}/8 · Day {p.cycleDay}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeText, { color: st.fg }]}>{p.status}</Text></View>
          </Pressable>
        );
      })}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={s.scrim} onPress={() => setDetail(null)}>
          <Pressable style={s.modal}>
            <View style={s.handle} />
            {detail && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <View style={[s.av, { width: 48, height: 48, borderRadius: 24 }]}><Text style={[s.avText, { fontSize: 16 }]}>{initials(detail.patient.name)}</Text></View>
                  <View><Text style={s.modalName}>{detail.patient.name}</Text><Text style={s.sub}>{detail.patient.package} · Week {detail.patient.week}/8</Text></View>
                </View>
                {[
                  ['Email', detail.patient.email],
                  ['Cycle Day', `Day ${detail.patient.cycleDay}`],
                  ['Status', detail.patient.status],
                  ['Concern', detail.patient.concern],
                  ['Trying Since', detail.patient.tryingSince],
                  ['Joined', fmtDate(detail.patient.joinedAt)],
                  ['Check-ins', `${detail.checkins.length} total`],
                  ['Reports', `${detail.reports.length} logged`],
                ].map(([l, v]) => (
                  <View key={l} style={s.dRow}><Text style={s.dLabel}>{l}</Text><Text style={s.dVal}>{v}</Text></View>
                ))}
                <Pressable style={s.closeBtn} onPress={() => setDetail(null)}><Text style={s.closeBtnText}>Close</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.charcoal },
  sub: { color: C.mid, fontSize: 13 },
  row: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.warm, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.sagePale, alignItems: 'center', justifyContent: 'center' },
  avText: { color: C.sage, fontWeight: '800', fontSize: 13 },
  name: { fontWeight: '800', fontSize: 15, color: C.charcoal },
  meta: { color: C.mid, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  scrim: { flex: 1, backgroundColor: 'rgba(42,40,37,.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: C.warm, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
  modalName: { fontSize: 20, fontWeight: '900', color: C.charcoal },
  dRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  dLabel: { color: C.mid, fontSize: 14 },
  dVal: { fontWeight: '700', color: C.charcoal, fontSize: 14 },
  closeBtn: { backgroundColor: C.sage, borderRadius: 24, padding: 14, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
