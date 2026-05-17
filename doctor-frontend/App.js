import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import C from './src/colors';
import { useSocket } from './src/useSocket';
import DashboardScreen from './src/screens/Dashboard';
import PatientsScreen from './src/screens/Patients';
import QueueScreen from './src/screens/Queue';
import ReportsScreen from './src/screens/Reports';
import NotesScreen from './src/screens/Notes';

const DOCTORS = [
  { id: 'dr_001', name: 'Dr. Divya K', avatar: 'DK', spec: 'Reproductive Endocrinology' },
  { id: 'dr_002', name: 'Dr. Praveen', avatar: 'PR', spec: 'Fertility & Lifestyle Medicine' },
];

function AppContent() {
  const insets = useSafeAreaInsets();
  const [doctor, setDoctor] = useState(DOCTORS[0]);
  const [tab, setTab] = useState('home');
  const [showPicker, setShowPicker] = useState(false);
  const [toast, setToast] = useState('');
  const { isConnected: connected, on: socketOn, off: socketOff } = useSocket();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const renderScreen = () => {
    const props = { doctorId: doctor.id, doctorName: doctor.name, showToast, socketOn, socketOff };
    switch (tab) {
      case 'patients': return <PatientsScreen {...props} />;
      case 'queue': return <QueueScreen {...props} />;
      case 'reports': return <ReportsScreen {...props} />;
      case 'notes': return <NotesScreen {...props} />;
      default: return <DashboardScreen {...props} onNav={setTab} />;
    }
  };

  const tabs = [
    ['home', 'Home', 'grid-outline'],
    ['patients', 'Patients', 'people-outline'],
    ['queue', 'Queue', 'clipboard-outline'],
    ['reports', 'Reports', 'document-text-outline'],
    ['notes', 'Notes', 'create-outline'],
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {/* Top Bar */}
      <View style={s.topbar}>
        <Text style={s.logo}>Lumi<Text style={s.logoAccent}>Nest</Text></Text>
        <View style={s.topRight}>
          <View style={[s.dot, connected && s.dotOn]} />
          <Pressable style={s.avatar} onPress={() => setShowPicker(!showPicker)}>
            <Text style={s.avatarText}>{doctor.avatar}</Text>
          </Pressable>
        </View>
      </View>

      {/* Doctor Picker */}
      {showPicker && (
        <View style={s.picker}>
          {DOCTORS.map(d => (
            <Pressable key={d.id} style={[s.pickerItem, d.id === doctor.id && s.pickerActive]}
              onPress={() => { setDoctor(d); setShowPicker(false); }}>
              <View style={s.pickerAvatar}><Text style={s.avatarText}>{d.avatar}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pickerName}>{d.name}</Text>
                <Text style={s.pickerSpec}>{d.spec}</Text>
              </View>
              {d.id === doctor.id && <Ionicons name="checkmark" size={18} color={C.sage} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Content */}
      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}>
        {renderScreen()}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={[s.nav, { paddingBottom: insets.bottom || 8 }]}>
        {tabs.map(([key, label, icon]) => (
          <Pressable key={key} style={s.navItem} onPress={() => setTab(key)}>
            <Ionicons name={icon} size={22} color={tab === key ? C.sage : C.muted} />
            <Text style={[s.navText, tab === key && s.navTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {toast ? <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View> : null}
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  topbar: { height: 56, paddingHorizontal: 16, backgroundColor: C.warm, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center' },
  logo: { fontSize: 22, fontWeight: '800', color: C.sage },
  logoAccent: { color: C.blush },
  topRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  dotOn: { backgroundColor: '#22c55e' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  picker: { backgroundColor: C.warm, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10 },
  pickerActive: { backgroundColor: C.sagePale },
  pickerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' },
  pickerName: { fontWeight: '700', fontSize: 14, color: C.charcoal },
  pickerSpec: { fontSize: 11, color: C.mid },
  content: { flex: 1 },
  nav: { backgroundColor: C.warm, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navText: { fontSize: 10, fontWeight: '700', color: C.muted },
  navTextActive: { color: C.sage },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 100, backgroundColor: C.charcoal, borderRadius: 24, padding: 12, alignItems: 'center' },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
