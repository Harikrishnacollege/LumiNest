import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultFirebaseConfig, initializeFirebase, isFirebaseConfigValid } from './src/firebase';

const STORAGE_KEY = 'luminest:local_state';
const AUTH_ENABLED = true;

const readStoredState = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredState = async (state) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore local persistence errors.
  }
};

const getServerUrl = () => {
  return process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:4000';
};

const postReportToServer = async (log, userName) => {
  try {
    const response = await fetch(`${getServerUrl()}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coupleId: log.coupleId || 'couple_001',
        coupleName: userName || 'Patient',
        date: log.date || new Date().toISOString().slice(0, 10),
        energy: log.energy || 'Good',
        mood: log.mood || 'Good',
        sleep: log.sleep || 'Okay',
        mucus: log.mucus || 'Dry / None',
        symptoms: log.symptoms || [],
        notes: log.notes || '',
      }),
    });
    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    console.log('✅ Report synced to server');
  } catch (error) {
    console.warn('⚠️ Failed to sync report to server:', error.message);
  }
};

const postCheckinToServer = async (checkinData, userName) => {
  try {
    const response = await fetch(`${getServerUrl()}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coupleId: checkinData.coupleId || 'couple_001',
        coupleName: userName || 'Patient',
        name: userName || 'Patient',
        week: checkinData.week || 1,
        summary: checkinData.summary || 'Weekly check-in submitted.',
        details: checkinData.details || {},
      }),
    });
    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    console.log('✅ Check-in synced to server');
  } catch (error) {
    console.warn('⚠️ Failed to sync check-in to server:', error.message);
  }
};

const generateJWTToken = async (email, password) => {
  try {
    const response = await fetch(`${getServerUrl()}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Token generation failed');
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('JWT generation error:', error);
    return null;
  }
};

const colors = {
  sage: '#6b9470',
  sageDark: '#355f3b',
  sagePale: '#eaf2ea',
  blush: '#e0a89e',
  blushPale: '#fdf1ef',
  cream: '#faf6f0',
  warm: '#fffdf9',
  charcoal: '#2a2825',
  mid: '#7a746e',
  muted: '#b0a89e',
  border: '#e8e2da',
  gold: '#c9a96e',
  goldPale: '#f7f0e2'
};

const seedPatient = {
  user: { id: 'couple_001', name: 'Priya & Arjun', package: 'Sprout', week: 3, cycleDay: 13, avatar: 'PA' },
  dailyTasks: ['Track energy', 'Log cervical mucus', 'Drink 2.5L water', 'Evening walk'],
  notes: [
    { id: 'note_001', title: 'Week 3 guidance', body: 'You are approaching your fertile window. Keep tracking mucus changes and prioritize sleep for the next few nights.', tone: 'sage' },
    { id: 'note_002', title: 'Nutrition focus', body: 'Add one protein-rich snack in the evening to keep energy stable.', tone: 'gold' }
  ],
  journey: [
    { title: 'Foundation', status: 'done', body: 'Cycle awareness, sleep rhythm, and daily check-in habit.' },
    { title: 'Fertile Window', status: 'current', body: 'Track mucus, BBT, intimacy timing, and stress recovery.' },
    { title: 'Nourish', status: 'next', body: 'Food, movement, and emotional support for the luteal phase.' }
  ],
  bbt: [36.4, 36.5, 36.3, 36.6, 36.5, 36.4, 36.7, 36.6, 36.5, 36.6, 36.8, 36.7, 36.5, 36.9],
  recentLogs: []
};

const seedDoctor = {
  user: { id: 'dr_001', name: 'Dr. Divya K', avatar: 'DK' },
  stats: [
    { label: 'Active couples', value: '24', tag: '+3 this week' },
    { label: 'Pending reviews', value: '3', tag: 'Today' },
    { label: 'On track', value: '81%', tag: 'Healthy' }
  ],
  focus: ['Review fertile-window check-ins', 'Send week 5 stress protocol', 'Update Sprout package guidance'],
  patients: [
    { id: 'couple_001', name: 'Priya & Arjun', package: 'Sprout', week: 3, status: 'On track', concern: 'Irregular cycles', tryingSince: '8 months' },
    { id: 'couple_002', name: 'Meera & Kiran', package: 'Bloom', week: 5, status: 'Needs attention', concern: 'Low energy', tryingSince: '1 year' },
    { id: 'couple_003', name: 'Anika & Rohan', package: 'Seed', week: 2, status: 'New check-in', concern: 'Cycle awareness', tryingSince: '4 months' }
  ],
  checkins: [
    { id: 'ci_001', name: 'Priya & Arjun', week: 3, status: 'pending', summary: 'Energy is steady. Cervical mucus changed to watery yesterday. Asking if timing is right.' },
    { id: 'ci_002', name: 'Meera & Kiran', week: 5, status: 'pending', summary: 'Stress is high this week and sleep dropped to 5 hours.' },
    { id: 'ci_003', name: 'Anika & Rohan', week: 2, status: 'pending', summary: 'Completed daily food and movement tasks for six days.' }
  ]
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const initialsForName = (name = '') => name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase() || 'LN';

const buildSeedForUser = (user) => {
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'New user';
  return {
    role: 'patient',
    patient: {
      ...seedPatient,
      user: {
        ...seedPatient.user,
        id: user?.uid || seedPatient.user.id,
        name: displayName,
        avatar: initialsForName(displayName)
      }
    },
    doctor: seedDoctor
  };
};

const getDailyStreak = (logs = []) => {
  const today = new Date();
  const logDates = new Set(logs.map((log) => log.date));
  let streak = 0;

  for (let offset = 0; offset < 60; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    if (!logDates.has(toIsoDate(day))) break;
    streak += 1;
  }

  return streak;
};

const buildWeekDots = (logs = []) => {
  const today = new Date();
  const todayIso = toIsoDate(today);
  const logDates = new Set(logs.map((log) => log.date));
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const iso = toIsoDate(date);
    return {
      key: iso,
      label: dayLabels[date.getDay()],
      done: logDates.has(iso),
      today: iso === todayIso
    };
  });
};

const hasLogForDate = (logs = [], dateIso) => logs.some((log) => log.date === dateIso);

const upsertLog = (logs = [], nextLog) => {
  const existingIndex = logs.findIndex((log) => log.date === nextLog.date);
  if (existingIndex === -1) return [nextLog, ...logs];
  const updated = [...logs];
  updated[existingIndex] = { ...logs[existingIndex], ...nextLog };
  return updated;
};

const getCyclePhaseLabel = (cycleDay = 1) => {
  if (cycleDay <= 5) return 'Period recovery';
  if (cycleDay <= 10) return 'Follicular build';
  if (cycleDay <= 16) return 'Fertile window';
  if (cycleDay <= 22) return 'Ovulation support';
  return 'Luteal phase';
};

const buildPatientStats = (patient) => {
  const streak = getDailyStreak(patient.recentLogs || []);
  const cycleDay = patient.user?.cycleDay || 1;
  const week = patient.user?.week || 1;
  const packageLabel = patient.user?.package || 'Program';
  const cycleTag = cycleDay >= 12 && cycleDay <= 16 ? 'Fertile soon' : 'Tracking';
  const streakTag = streak >= 5 ? 'Great' : streak ? 'Building' : 'Start today';

  return [
    { label: 'Program week', value: `${week}/8`, tag: packageLabel },
    { label: 'Cycle day', value: `${cycleDay}`, tag: cycleTag },
    { label: 'Daily streak', value: `${streak}`, tag: streakTag }
  ];
};

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const getCycleInfo = (cycleDay) => {
  const cd = Math.max(1, Math.min(28, cycleDay || 1));
  const inFertile = cd >= 12 && cd <= 16;
  const daysToFertile = cd < 12 ? 12 - cd : cd > 16 ? 28 - cd + 12 : 0;
  return { cd, inFertile, isOvulation: cd === 14, daysToFertile };
};

const getProgramPhase = (week) => {
  if (week <= 2) return 'Awareness';
  if (week <= 4) return 'Pattern Recognition';
  if (week <= 6) return 'Ovulation Optimisation';
  return 'Holistic Optimisation';
};

const getMonthCal = (y, m) => ({
  offset: (new Date(y, m, 1).getDay() + 6) % 7,
  days: new Date(y, m + 1, 0).getDate()
});

const fmtMonthYear = (y, m) => new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const fmtDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

function AppContent() {
  const insets = useSafeAreaInsets();
  const navHeight = 70;
  const contentPaddingBottom = 24 + navHeight + insets.bottom;
  const [hydrated, setHydrated] = useState(false);
  const [envReady, setEnvReady] = useState(!AUTH_ENABLED);
  const [firebaseConfig, setFirebaseConfig] = useState(getDefaultFirebaseConfig());
  const [firebaseAuth, setFirebaseAuth] = useState(null);
  const [firestoreDb, setFirestoreDb] = useState(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isConfigValid, setIsConfigValid] = useState(false);
  const [dataReady, setDataReady] = useState(!AUTH_ENABLED);
  const [signedIn, setSignedIn] = useState(!AUTH_ENABLED);
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('patient');
  const [activeTab, setActiveTab] = useState('home');
  const [patient, setPatient] = useState(seedPatient);
  const [doctor, setDoctor] = useState(seedDoctor);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [toast, setToast] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const currentUser = role === 'patient' ? patient.user : doctor.user;

  useEffect(() => {
    const hydrateEnv = async () => {
      if (!AUTH_ENABLED) return;

      const defaultFirebase = getDefaultFirebaseConfig();
      setFirebaseConfig(defaultFirebase);

      const valid = isFirebaseConfigValid(defaultFirebase);
      setIsConfigValid(valid);

      if (valid) {
        const initialized = await initializeFirebase(defaultFirebase);
        setFirebaseAuth(initialized.auth);
        setFirestoreDb(initialized.db);
        setFirebaseReady(initialized.ready);
      }

      setEnvReady(true);
    };

    hydrateEnv();
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      const stored = await readStoredState();
      if (!stored) return;
      if (stored.role) setRole(stored.role);
      if (stored.patient) setPatient({ ...seedPatient, ...stored.patient });
      if (stored.doctor) setDoctor({ ...seedDoctor, ...stored.doctor });
      if (stored.activeTab) setActiveTab(stored.activeTab);
    };

    hydrate().finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredState({ role, patient, doctor, activeTab });
  }, [hydrated, role, patient, doctor, activeTab]);

  useEffect(() => {
    if (!AUTH_ENABLED) return undefined;
    if (!firebaseAuth) return undefined;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user || null);
      if (!user) {
        setSignedIn(false);
        setDataReady(false);
        return;
      }

      setSignedIn(true);
      await loadUserData(user);
    });

    return unsubscribe;
  }, [firebaseAuth]);

  // Email/Password auth is handled by onAuthStateChanged effect above

  useEffect(() => {
    if (!AUTH_ENABLED || !signedIn || !authUser || !dataReady) return;
    const timer = setTimeout(() => {
      persistUserData();
    }, 500);
    return () => clearTimeout(timer);
  }, [signedIn, authUser, dataReady, role, patient, doctor]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  };

  const persistUserData = async (override = {}) => {
    if (!authUser || !firestoreDb) return;
    try {
      await setDoc(doc(firestoreDb, 'users', authUser.uid), {
        role: override.role ?? role,
        patient: override.patient ?? patient,
        doctor: override.doctor ?? doctor,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Ignore Firestore write errors to keep UI responsive.
    }
  };

  const loadUserData = async (user) => {
    if (!firestoreDb) {
      const seed = buildSeedForUser(user);
      setRole(seed.role);
      setPatient(seed.patient);
      setDoctor(seed.doctor);
      setDataReady(true);
      return;
    }
    setLoading(true);
    try {
      const snapshot = await getDoc(doc(firestoreDb, 'users', user.uid));
      if (snapshot.exists()) {
        const data = snapshot.data() || {};
        const displayName = data.patient?.user?.name || user.displayName || seedPatient.user.name;
        const nextPatient = {
          ...seedPatient,
          ...(data.patient || {}),
          user: {
            ...seedPatient.user,
            ...(data.patient?.user || {}),
            id: user.uid,
            name: displayName,
            avatar: data.patient?.user?.avatar || initialsForName(displayName)
          }
        };
        setRole(data.role || 'patient');
        setPatient(nextPatient);
        setDoctor({ ...seedDoctor, ...(data.doctor || {}) });
      } else {
        const seed = buildSeedForUser(user);
        setRole(seed.role);
        setPatient(seed.patient);
        setDoctor(seed.doctor);
        await setDoc(doc(firestoreDb, 'users', user.uid), { ...seed, createdAt: serverTimestamp() });
      }
      setDataReady(true);
    } catch (error) {
      // Fallback: use seed data if Firestore fails
      const seed = buildSeedForUser(user);
      setRole(seed.role);
      setPatient(seed.patient);
      setDoctor(seed.doctor);
      setDataReady(true);
      showToast('Working offline - local data');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (email, password, isSignUp) => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (!firebaseAuth) {
        Alert.alert('Error', 'Firebase not initialized');
        return;
      }

      if (isSignUp) {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
        showToast('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        showToast('Signed in successfully!');
      }

      setAuthEmail('');
      setAuthPassword('');
    } catch (error) {
      let message = 'Authentication failed';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use. Please sign in or use a different email.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'User not found. Please create an account first.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Wrong password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      }
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (firebaseAuth) {
        await signOut(firebaseAuth);
      }
      setSignedIn(false);
      setAuthUser(null);
      setDataReady(false);
      setShowProfile(false);
    } catch {
      // Ignore sign-out errors.
    }
  };

  const resetLocalData = () => {
    Alert.alert('Reset local data', 'This will clear your local configuration and logs. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setPatient(seedPatient);
          setDoctor(seedDoctor);
          setRole('patient');
          setActiveTab('home');
          if (AUTH_ENABLED && authUser && firestoreDb) {
            const seed = buildSeedForUser(authUser);
            await setDoc(doc(firestoreDb, 'users', authUser.uid), { ...seed, updatedAt: serverTimestamp() }, { merge: true });
          }
          showToast('Local data reset');
        }
      }
    ]);
  };

  const updateProfileLocal = (updates) => {
    setPatient((current) => {
      const next = {
        ...current,
        user: {
          ...current.user,
          ...updates
        }
      };
      persistUserData({ patient: next });
      return next;
    });
  };

  const addDailyTask = (task) => {
    const trimmed = task.trim();
    if (!trimmed) return;
    setPatient((current) => {
      const tasks = Array.from(new Set([...(current.dailyTasks || []), trimmed]));
      const next = { ...current, dailyTasks: tasks };
      persistUserData({ patient: next });
      return next;
    });
  };

  const removeDailyTask = (task) => {
    setPatient((current) => {
      const next = {
        ...current,
        dailyTasks: (current.dailyTasks || []).filter((item) => item !== task)
      };
      persistUserData({ patient: next });
      return next;
    });
  };

  const addNote = (note) => {
    setPatient((current) => {
      const next = {
        ...current,
        notes: [{ id: `note_${Date.now()}`, ...note }, ...(current.notes || [])]
      };
      persistUserData({ patient: next });
      return next;
    });
  };

  const addBbt = (value) => {
    if (!Number.isFinite(value)) return;
    setPatient((current) => {
      const next = {
        ...current,
        bbt: [...(current.bbt || []), value].slice(-31)
      };
      persistUserData({ patient: next });
      return next;
    });
  };

  const saveLog = async (log) => {
    const optimistic = {
      id: `local_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      ...log
    };
    const updatedLogs = upsertLog(patient.recentLogs || [], optimistic);
    const nextPatient = { ...patient, recentLogs: updatedLogs };
    setPatient(nextPatient);
    await persistUserData({ patient: nextPatient });

    // Sync report to unified server (triggers real-time update on doctor frontend)
    postReportToServer(
      { ...optimistic, coupleId: patient.user?.id || 'couple_001' },
      patient.user?.name || 'Patient'
    );

    showToast('Daily log saved');
  };

  const submitCheckin = async (checkinDetails = {}) => {
    const next = {
      ...patient,
      recentLogs: patient.recentLogs || []
    };
    await persistUserData({ patient: next });

    // Build a summary from the check-in details
    const parts = [];
    if (checkinDetails.health) parts.push(checkinDetails.health);
    if (checkinDetails.improved) parts.push(`Improved: ${checkinDetails.improved}`);
    if (checkinDetails.worsened) parts.push(`Worsened: ${checkinDetails.worsened}`);
    const summary = parts.length > 0 ? parts.join('. ') : 'Weekly check-in submitted.';

    // Sync check-in to unified server (triggers real-time update on doctor frontend)
    postCheckinToServer(
      {
        coupleId: patient.user?.id || 'couple_001',
        week: patient.user?.week || 1,
        summary,
        details: {
          health: checkinDetails.health || '',
          improved: checkinDetails.improved || '',
          worsened: checkinDetails.worsened || '',
          cycleObs: checkinDetails.cycleObs || '',
          emotional: checkinDetails.emotional || 'Good',
          question: checkinDetails.question || '',
        },
      },
      patient.user?.name || 'Patient'
    );

    showToast('Check-in submitted');
  };

  const sendResponse = async (checkinId) => {
    setDoctor((current) => {
      const next = {
        ...current,
        checkins: current.checkins.map((item) => (item.id === checkinId ? { ...item, status: 'responded' } : item))
      };
      persistUserData({ doctor: next });
      return next;
    });
    showToast('Response sent');
  };

  if (!envReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sage} />
          <Text style={styles.subText}>Loading configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (AUTH_ENABLED && !signedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScrollView style={styles.authContainer} contentContainerStyle={styles.authContent}>
          <View style={styles.loginHero}>
            <Text style={styles.logo}>Lumi<Text style={styles.logoAccent}>Nest</Text></Text>
            <Text style={styles.loginTagline}>{authMode === 'login' ? 'Sign in to your account' : 'Create an account to get started'}</Text>
          </View>
          <View style={styles.authForm}>
            <TextInput
              style={styles.authInput}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={authEmail}
              onChangeText={setAuthEmail}
              editable={!loading}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
              editable={!loading}
            />
            <Pressable style={[styles.authButton, loading && styles.authButtonDisabled]} onPress={() => handleEmailAuth(authEmail, authPassword, authMode === 'signup')} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.authButtonText}>{authMode === 'login' ? 'Sign In' : 'Sign Up'}</Text>}
            </Pressable>
            <Pressable onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} disabled={loading}>
              <Text style={styles.toggleText}>{authMode === 'login' ? 'Don\'t have an account? Sign up' : 'Have an account? Sign in'}</Text>
            </Pressable>
          </View>
          {!isConfigValid && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={18} color={colors.charcoal} />
              <Text style={styles.warningText}>Firebase config not found. Add your config to mobile/.env and restart Expo.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (AUTH_ENABLED && !dataReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sage} />
          <Text style={styles.subText}>Syncing your workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <TopBar user={currentUser} onReset={resetLocalData} onOpenProfile={() => setShowProfile(true)} />
      <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: contentPaddingBottom }] }>
        {role === 'patient' ? (
          <PatientTab
            tab={activeTab}
            data={patient}
            onSaveLog={saveLog}
            onSubmitCheckin={submitCheckin}
            onUpdateProfile={updateProfileLocal}
            onAddTask={addDailyTask}
            onRemoveTask={removeDailyTask}
            onAddNote={addNote}
            onAddBbt={addBbt}
          />
        ) : (
          <DoctorTab
            tab={activeTab}
            data={doctor}
            onOpenPatient={setSelectedPatient}
            onSendResponse={sendResponse}
          />
        )}
      </ScrollView>
      <BottomNav role={role} activeTab={activeTab} onChange={setActiveTab} pending={doctor.checkins.filter((item) => item.status === 'pending').length} insetBottom={insets.bottom} />
      <PatientModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      <ProfileModal user={currentUser} role={role} visible={showProfile} onClose={() => setShowProfile(false)} onSignOut={handleSignOut} />
      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function TopBar({ user, onReset, onOpenProfile }) {
  return (
    <View style={styles.topbar}>
      <Text style={styles.topLogo}>Lumi<Text style={styles.topLogoAccent}>Nest</Text></Text>
      <View style={styles.topActions}>
        <Pressable style={styles.resetButton} onPress={onReset}>
          <Ionicons name="refresh" size={18} color={colors.sage} />
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.avatar} onPress={onOpenProfile}>
          <Text style={styles.avatarText}>{user?.avatar || 'LN'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PatientTab({ tab, data, onSaveLog, onSubmitCheckin, onUpdateProfile, onAddTask, onRemoveTask, onAddNote, onAddBbt }) {
  if (tab === 'daily') {
    return (
      <DailyScreen
        profile={data.user}
        tasks={data.dailyTasks}
        notes={data.notes}
        recentLogs={data.recentLogs}
        onSaveLog={onSaveLog}
        onSubmitCheckin={onSubmitCheckin}
        onUpdateProfile={onUpdateProfile}
        onAddTask={onAddTask}
        onRemoveTask={onRemoveTask}
        onAddNote={onAddNote}
        onAddBbt={onAddBbt}
      />
    );
  }
  if (tab === 'cycle') return <CycleScreen bbt={data.bbt} cycleDay={data.user?.cycleDay} />;
  if (tab === 'checkin') return <CheckInScreen week={data.user?.week} onSubmit={onSubmitCheckin} />;
  if (tab === 'ovulation') return <OvulationScreen cycleDay={data.user?.cycleDay} bbt={data.bbt} onSaveLog={onSaveLog} onAddBbt={onAddBbt} />;
  if (tab === 'doctorcorner') return <DoctorCorner notes={data.notes} />;
  if (tab === 'journey') return <JourneyScreen week={data.user?.week} packageName={data.user?.package} />;
  if (tab === 'wellness') return <WellnessScreen />;
  if (tab === 'doctor') return <DoctorCorner notes={data.notes} />;
  if (tab === 'more') return <MoreMenuScreen journey={data.journey} recentLogs={data.recentLogs} />;

  // HOME
  const greeting = getGreeting();
  const weekDots = buildWeekDots(data.recentLogs || []);
  const todayIso = toIsoDate(new Date());
  const hasTodayLog = hasLogForDate(data.recentLogs || [], todayIso);
  const streak = getDailyStreak(data.recentLogs || []);
  const week = data.user?.week || 1;
  const cycleDay = data.user?.cycleDay || 1;
  const cycleInfo = getCycleInfo(cycleDay);
  const progress = ((week / 8) * 100).toFixed(1);
  const phase = getProgramPhase(week);

  return (
    <View>
      <Hero
        eyebrow={`${greeting} ✦`}
        title={`Hello, ${data.user.name} 🌿`}
        subtitle={`Week ${week} of your journey`}
        pill={`${data.user.package} Package · ${week}/8 weeks`}
      />
      <StatRow stats={[
        { label: 'Day streak', value: `${streak}`, tag: streak >= 5 ? '🔥 Keep going' : 'Start today' },
        { label: 'Days to fertile', value: cycleInfo.inFertile ? '0' : `${cycleInfo.daysToFertile}`, tag: cycleInfo.inFertile ? '🌟 Now!' : 'Coming up' },
        { label: 'Check-ins done', value: `${Math.min(week, 3)}`, tag: 'On track' },
        { label: 'Unread notes', value: '1', tag: 'New 💌' }
      ]} />
      <Section title="Today's Log">
        <Text style={styles.subText}>{hasTodayLog ? '✓ Logged today' : "Haven't logged yet today"}</Text>
        <View style={[styles.streakRow, { marginTop: 10 }]}>{weekDots.map((item) => <DayDot key={item.key} day={item.label} done={item.done} today={item.today} />)}</View>
        <Text style={styles.subText}>{streak > 0 ? `${streak} day streak — you're on a roll 🌱` : 'Start your streak today! 🌱'}</Text>
      </Section>
      <Section title={`Cycle Overview · Day ${cycleDay} of 28`}>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${(cycleDay / 28) * 100}%` }]} /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <Text style={[styles.pillTag, { backgroundColor: colors.blushPale, color: '#c47a72' }]}>Period 1–5</Text>
          <Text style={[styles.pillTag, { backgroundColor: colors.goldPale, color: '#a07838' }]}>Fertile 12–16</Text>
          <Text style={[styles.pillTag, { backgroundColor: colors.sagePale, color: colors.sage }]}>Ovulation ~14</Text>
        </View>
      </Section>
      {(data.notes || []).length > 0 && (
        <Section title="Latest from Dr. Divya">
          <Note note={data.notes[0]} />
        </Section>
      )}
      <Section title="8-Week Journey">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.subText}>{phase} phase</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sage }}>{progress}%</Text>
        </View>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      </Section>
    </View>
  );
}

function DailyScreen({ profile, tasks, notes, recentLogs, onSaveLog, onSubmitCheckin, onUpdateProfile, onAddTask, onRemoveTask, onAddNote, onAddBbt }) {
  const [energy, setEnergy] = useState('Good');
  const [mood, setMood] = useState('Good');
  const [sleep, setSleep] = useState('Okay');
  const [mucus, setMucus] = useState('Creamy / Lotion-like');
  const [dailyNotes, setDailyNotes] = useState('');
  const [symptoms, setSymptoms] = useState({ 'Bloating': false, 'Breast tenderness': true, 'Cramps': false, 'Headache': false, 'Spotting': false, 'Nausea': false });
  const weekDots = buildWeekDots(recentLogs || []);
  const streak = getDailyStreak(recentLogs || []);

  const toggleSymptom = (name) => setSymptoms(prev => ({ ...prev, [name]: !prev[name] }));

  return (
    <View>
      <PageHeader title="Daily Tracker" subtitle={fmtDate(new Date())} />
      <Section title="How are you today?">
        <OptionRow label="⚡ Energy Level" value={energy} options={['😴 Low', '😐 Okay', '😊 Good', '⚡ High']} onChange={setEnergy} />
        <OptionRow label="🌈 Mood" value={mood} options={['😞 Low', '😐 Neutral', '🙂 Good', '😄 Great']} onChange={setMood} />
        <OptionRow label="💤 Sleep Quality" value={sleep} options={['😫 Poor', '😌 Okay', '😴 Good', '✨ Great']} onChange={setSleep} />
        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>🌺 Cervical Mucus</Text>
          <View style={styles.optionRow}>
            {['Dry / None', 'Creamy / Lotion-like', 'Watery', 'Egg-white (stretchy)', 'Sticky'].map((opt) => (
              <Pressable key={opt} style={[styles.option, mucus === opt && styles.optionActive]} onPress={() => setMucus(opt)}>
                <Text style={[styles.optionText, mucus === opt && styles.optionTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>🤒 Symptoms</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
            {Object.entries(symptoms).map(([name, active]) => (
              <Pressable key={name} onPress={() => toggleSymptom(name)} style={[styles.pillTag, { backgroundColor: active ? colors.sagePale : colors.cream, borderWidth: 1, borderColor: active ? colors.sage : colors.border, paddingHorizontal: 10, paddingVertical: 5 }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? colors.sage : colors.mid }}>{name}{active ? ' ✓' : ''}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label="📝 Notes" value={dailyNotes} onChangeText={setDailyNotes} multiline placeholder="Anything you noticed today..." />
        <View style={[styles.streakRow, { marginTop: 10 }]}>{weekDots.map((item) => <DayDot key={item.key} day={item.label} done={item.done} today={item.today} />)}</View>
        <Pressable style={styles.primaryButton} onPress={() => onSaveLog({ energy, mood, sleep, mucus, symptoms: Object.entries(symptoms).filter(([,v]) => v).map(([k]) => k), notes: dailyNotes })}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Save Today's Log ✓</Text>
        </Pressable>
      </Section>
      <Section title="Your profile">
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Name</Text><Text style={styles.rowValue}>{profile?.name}</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Package</Text><Text style={styles.rowValue}>{profile?.package}</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Week</Text><Text style={styles.rowValue}>{profile?.week}</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Cycle day</Text><Text style={styles.rowValue}>{profile?.cycleDay}</Text></View>
      </Section>
    </View>
  );
}

function CycleScreen({ bbt, cycleDay }) {
  const cycleLength = 28;
  const currentDay = Math.max(1, Math.min(cycleLength, cycleDay || 1));
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const { offset, days } = getMonthCal(calYear, calMonth);
  const todayDate = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const dayHeaders = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const cycleInfo = getCycleInfo(currentDay);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); };

  const isCurrentMonth = calMonth === todayMonth && calYear === todayYear;

  return (
    <View>
      <PageHeader title="Cycle Tracker" subtitle="Track your cycle, flow & patterns" />
      <Section title={fmtMonthYear(calYear, calMonth)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Pressable style={styles.calNavBtn} onPress={prevMonth}><Text style={styles.calNavText}>‹</Text></Pressable>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.charcoal }}>{fmtMonthYear(calYear, calMonth)}</Text>
          <Pressable style={styles.calNavBtn} onPress={nextMonth}><Text style={styles.calNavText}>›</Text></Pressable>
        </View>
        <View style={styles.calHeaderRow}>
          {dayHeaders.map((d) => <Text key={d} style={styles.calHeaderText}>{d}</Text>)}
        </View>
        <View style={styles.calendar}>
          {Array.from({ length: offset }, (_, i) => <View key={`e${i}`} style={styles.calendarDay} />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const isToday = isCurrentMonth && day === todayDate;
            const period = isCurrentMonth && day >= 1 && day <= 5;
            const fertile = isCurrentMonth && day >= 12 && day <= 16;
            const ovulation = isCurrentMonth && day === 14;
            return (
              <View key={day} style={[styles.calendarDay, period && styles.periodDay, fertile && styles.fertileDay, ovulation && styles.ovulationDay, isToday && styles.currentDay]}>
                <Text style={[styles.calendarText, (period || fertile || ovulation) && styles.calendarTextActive]}>{day}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <Legend color={colors.blush} label="Period" />
          <Legend color={colors.sage} label="Fertile" />
          <Legend color={colors.gold} label="Ovulation" />
          <Legend color={colors.charcoal} label="Today" />
        </View>
      </Section>
      <Section title={`Log Today · Cycle day ${currentDay}`}>
        <OptionRow label="Bleeding" value="None" options={['None', 'Light', 'Medium', 'Heavy']} onChange={() => {}} />
        <OptionRow label="Pain Level" value="None" options={['None', 'Mild', 'Moderate', 'Severe']} onChange={() => {}} />
      </Section>
      <Section title="Cycle Insights">
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Average cycle length</Text><Text style={styles.rowValue}>28 days</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Current cycle day</Text><Text style={styles.rowValue}>Day {currentDay}</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Fertile window</Text><Text style={styles.rowValue}>Day 12–16</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Estimated ovulation</Text><Text style={styles.rowValue}>Day 14</Text></View>
        <View style={styles.rowBetween}><Text style={styles.rowLabel}>Days to fertile</Text><Text style={styles.rowValue}>{cycleInfo.inFertile ? 'Now!' : `${cycleInfo.daysToFertile} days`}</Text></View>
      </Section>
      {(bbt || []).length > 0 && (
        <Section title="BBT trend">
          <View style={styles.chart}>{bbt.map((temp, index) => <BbtBar key={`${temp}${index}`} temp={temp} />)}</View>
        </Section>
      )}
    </View>
  );
}

function DoctorCorner({ notes }) {
  return (
    <View>
      <PageHeader title="Doctor's Corner" subtitle="Guidance and notes from your fertility care team." />
      {notes.map((note) => <Note key={note.id} note={note} />)}
      <Section title="Next appointment">
        <Feature icon="videocam-outline" text="Video review scheduled for Friday, 5:30 PM" />
        <Feature icon="document-text-outline" text="Your latest logs will be attached automatically." />
      </Section>
    </View>
  );
}

function CheckInScreen({ week = 1, onSubmit }) {
  const [health, setHealth] = useState('');
  const [improved, setImproved] = useState('');
  const [worsened, setWorsened] = useState('');
  const [cycleObs, setCycleObs] = useState('');
  const [emotional, setEmotional] = useState('Good');
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    onSubmit({ health, improved, worsened, cycleObs, emotional, question });
    setHealth(''); setImproved(''); setWorsened('');
    setCycleObs(''); setEmotional('Good'); setQuestion('');
  };

  return (
    <View>
      <PageHeader title="Weekly Check-In" subtitle={`Week ${week} · Due by Sunday evening`} />
      <Section title={`Week ${week} Check-In`}>
        <View style={[styles.note, { marginBottom: 14 }]}>
          <Text style={styles.noteBody}>Dr. Divya will respond within 48 hours of your submission.</Text>
        </View>
        <Field label="Overall health this week" value={health} onChangeText={setHealth} multiline placeholder="Energy, mood, sleep..." />
        <Field label="What improved?" value={improved} onChangeText={setImproved} multiline placeholder="Symptoms that got better..." />
        <Field label="What worsened or is new?" value={worsened} onChangeText={setWorsened} multiline placeholder="New or worsening symptoms..." />
        <Field label="Cycle & ovulation this week" value={cycleObs} onChangeText={setCycleObs} multiline placeholder="CM, fertile signs..." />
        <OptionRow label="Emotional state" value={emotional} options={['Struggling', 'Okay', 'Good', 'Excellent']} onChange={setEmotional} />
        <Field label="Question for Dr. Divya?" value={question} onChangeText={setQuestion} multiline placeholder="Optional question..." />
        <Pressable style={styles.primaryButton} onPress={handleSubmit}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Submit Week {week} Check-In</Text>
        </Pressable>
      </Section>
    </View>
  );
}

function OvulationScreen({ cycleDay = 1, bbt = [], onSaveLog, onAddBbt }) {
  const cycleInfo = getCycleInfo(cycleDay);
  const [cmType, setCmType] = useState('Creamy');
  const [sensation, setSensation] = useState('Wet');
  const [bbtEntry, setBbtEntry] = useState('');
  const [ovPain, setOvPain] = useState('Yes');

  return (
    <View>
      <PageHeader title="Ovulation Tracker" subtitle="Track your fertile signs" />
      <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.goldPale }]}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#a07838', marginBottom: 4 }}>
          {cycleInfo.inFertile ? '🥚 FERTILE WINDOW ACTIVE' : '🥚 FERTILE WINDOW'}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.charcoal }}>
          {cycleInfo.isOvulation ? 'Today is your most fertile day' : cycleInfo.inFertile ? 'You are in your fertile window' : `${cycleInfo.daysToFertile} days until fertile window`}
        </Text>
        <Text style={[styles.subText, { marginTop: 6 }]}>Cycle Day {cycleInfo.cd} — Based on your CM & cycle data.</Text>
      </View>
      <Section title="Today's Observations">
        <OptionRow label="🌺 CM Type" value={cmType} options={['Dry', 'Sticky', 'Creamy', 'Egg-white']} onChange={setCmType} />
        <OptionRow label="💧 Sensation" value={sensation} options={['Dry', 'Sticky', 'Wet', 'Slippery']} onChange={setSensation} />
        <View style={styles.inputRow}>
          <TextInput style={styles.inlineInput} placeholder="BBT (e.g. 36.7)" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={bbtEntry} onChangeText={setBbtEntry} />
          <Pressable style={styles.smallButton} onPress={() => { const v = parseFloat(bbtEntry); if (v) { onAddBbt(v); setBbtEntry(''); } }}>
            <Ionicons name="thermometer" size={18} color="#fff" />
          </Pressable>
        </View>
        <OptionRow label="Ovulation Pain?" value={ovPain} options={['Yes — mild', 'No']} onChange={setOvPain} />
        <Pressable style={styles.primaryButton} onPress={() => onSaveLog({ cmType, sensation, ovPain })}>
          <Text style={styles.primaryButtonText}>Save Observations ✓</Text>
        </Pressable>
      </Section>
      <Section title="CM Progression Guide">
        {[
          { type: 'Dry / None', desc: 'Post-period · Low fertility', color: colors.muted },
          { type: 'Sticky / Tacky', desc: 'Low fertility', color: '#c8b4a0' },
          { type: 'Creamy / Lotion', desc: 'Building fertility', color: colors.sagePale },
          { type: 'Watery', desc: 'Increasing fertility', color: colors.sage },
          { type: 'Egg-white (stretchy) ✦', desc: 'Peak fertility 🌟', color: colors.gold }
        ].map((item) => (
          <View key={item.type} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.charcoal }}>{item.type}</Text>
              <Text style={{ fontSize: 11.5, color: colors.mid }}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </Section>
      {bbt.length > 0 && (
        <Section title="BBT Trend">
          <View style={styles.chart}>{bbt.map((temp, i) => <BbtBar key={`${temp}${i}`} temp={temp} />)}</View>
        </Section>
      )}
    </View>
  );
}

function JourneyScreen({ week = 1, packageName = 'Sprout' }) {
  const progress = ((week / 8) * 100).toFixed(1);
  const phases = [
    { name: 'Awareness', range: 'Weeks 1–2', desc: 'Building baseline observations of your cycle, energy, and body signals.', num: 1 },
    { name: 'Pattern Recognition', range: 'Weeks 3–4', desc: 'Identifying your unique cycle patterns — CM progression, energy shifts, BBT trends.', num: 2 },
    { name: 'Ovulation Optimisation', range: 'Weeks 5–6', desc: 'Refining fertile window accuracy. Introducing BBT confirmation.', num: 3 },
    { name: 'Holistic Optimisation', range: 'Weeks 7–8', desc: 'Final adjustments, lifestyle optimisation, and final assessment.', num: 4 }
  ];
  const currentPhaseNum = week <= 2 ? 1 : week <= 4 ? 2 : week <= 6 ? 3 : 4;

  return (
    <View>
      <PageHeader title="8-Week Journey" subtitle={`${packageName} Package`} />
      <Section title="Overall Progress">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.subText}>Overall progress</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sage }}>{progress}% Complete</Text>
        </View>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      </Section>
      {phases.map((p) => {
        const isDone = p.num < currentPhaseNum;
        const isCurrent = p.num === currentPhaseNum;
        return (
          <View key={p.name} style={[styles.phase, isDone && styles.phaseDone, isCurrent && styles.phaseCurrent, !isDone && !isCurrent && { opacity: 0.5 }]}>
            <Text style={styles.phaseKicker}>Phase {p.num} · {p.range} · {isDone ? '✓ Complete' : isCurrent ? 'In Progress ◀' : 'Upcoming'}</Text>
            <Text style={styles.phaseTitle}>{p.name}</Text>
            <Text style={styles.subText}>{p.desc}</Text>
            {isDone && <Text style={[styles.pillTag, { backgroundColor: colors.sagePale, color: colors.sage, marginTop: 8, alignSelf: 'flex-start' }]}>Check-ins submitted</Text>}
          </View>
        );
      })}
    </View>
  );
}

function WellnessScreen() {
  const [reflection, setReflection] = useState('');

  return (
    <View>
      <PageHeader title="Wellness" subtitle="Emotional support tools for your journey" />
      <Section title="Breathing Exercise">
        <BreathingCard />
      </Section>
      <Section title="This Week's Prompt 📔">
        <View style={{ backgroundColor: colors.sagePale, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 18, color: colors.charcoal, lineHeight: 26 }}>"What has this journey taught you about yourself or your relationship?"</Text>
        </View>
        <Field label="" value={reflection} onChangeText={setReflection} multiline placeholder="Write your reflection..." />
        <Pressable style={styles.secondaryButton} onPress={() => setReflection('')}>
          <Text style={styles.secondaryButtonText}>Save Reflection</Text>
        </Pressable>
      </Section>
      <Section title="For Arjun 💙">
        {['Understanding the Fertile Window', 'How to Support Your Partner', 'Male Factor Fertility Basics'].map((item) => (
          <View key={item} style={{ backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.charcoal }}>{item}</Text>
          </View>
        ))}
      </Section>
      <View style={[styles.card, { borderColor: '#f0c4c0' }]}>
        <Text style={{ color: '#d4736a', fontWeight: '800', marginBottom: 8 }}>⚠️ Red Flag Prompts</Text>
        <Text style={styles.subText}>When to contact your doctor</Text>
        {['No period for 60+ days without pregnancy', 'Severe pelvic pain lasting 48+ hours', 'No ovulation signs for 3+ consecutive cycles', 'Heavy bleeding outside period days'].map((item) => (
          <View key={item} style={{ backgroundColor: '#fdf0ee', borderRadius: 10, padding: 10, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: colors.charcoal }}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MoreMenuScreen({ journey, recentLogs }) {
  return (
    <View>
      <PageHeader title="More" subtitle="Journey, wellness, and recent activity." />
      <Section title="8-week journey">
        {journey.map((phase) => <Phase key={phase.title} phase={phase} />)}
      </Section>
      <Section title="Wellness">
        <BreathingCard />
      </Section>
      <Section title="Recent logs">
        {(recentLogs || []).length ? recentLogs.map((log) => <Feature key={log.id} icon="time-outline" text={`${log.date}: ${log.energy}, ${log.mood}, ${log.mucus}`} />) : <Text style={styles.subText}>No logs yet. Save today's check-in to see it here.</Text>}
      </Section>
    </View>
  );
}

function DoctorTab({ tab, data, onOpenPatient, onSendResponse }) {
  if (tab === 'patients') {
    return (
      <View>
        <PageHeader title="Patients" subtitle="Active couples in the LumiNest program." />
        {data.patients.map((patient) => <PatientRow key={patient.id} patient={patient} onPress={() => onOpenPatient(patient)} />)}
      </View>
    );
  }

  if (tab === 'queue') {
    return (
      <View>
        <PageHeader title="Review Queue" subtitle="Weekly check-ins waiting for care-team response." />
        {data.checkins.map((item) => <CheckinCard key={item.id} item={item} onSend={() => onSendResponse(item.id)} />)}
      </View>
    );
  }

  if (tab === 'guidance') {
    return (
      <View>
        <PageHeader title="Guidance" subtitle="Reusable recommendations for common care moments." />
        {['Fertile window timing', 'Stress and sleep reset', 'Partner nutrition protocol'].map((item) => <Feature key={item} icon="create-outline" text={item} />)}
      </View>
    );
  }

  if (tab === 'analytics') {
    return (
      <View>
        <PageHeader title="Analytics" subtitle="Program signals across active patients." />
        <StatRow stats={data.stats} />
        <Section title="Completion trend">
          <View style={styles.progress}><View style={[styles.progressFill, { width: '81%' }]} /></View>
          <Text style={styles.subText}>81% of couples completed at least five daily logs this week.</Text>
        </Section>
      </View>
    );
  }

  return (
    <View>
      <Hero eyebrow="Doctor dashboard" title="Care-team priorities for today" pill="3 check-ins pending" />
      <StatRow stats={data.stats} />
      <Section title="Focus list">
        {data.focus.map((item) => <Feature key={item} icon="radio-button-on-outline" text={item} />)}
      </Section>
      <Section title="Latest queue">
        {data.checkins.slice(0, 2).map((item) => <CheckinCard key={item.id} item={item} onSend={() => onSendResponse(item.id)} compact />)}
      </Section>
    </View>
  );
}

function BottomNav({ role, activeTab, onChange, pending, insetBottom }) {
  const patientTabs = [
    ['home', 'Home', 'home-outline'],
    ['daily', 'Daily', 'create-outline'],
    ['cycle', 'Cycle', 'moon-outline'],
    ['checkin', 'Check-In', 'checkmark-circle-outline'],
    ['more', 'More', 'menu-outline']
  ];
  const doctorTabs = [
    ['home', 'Home', 'speedometer-outline'],
    ['patients', 'Patients', 'people-outline'],
    ['queue', 'Queue', 'clipboard-outline'],
    ['guidance', 'Guidance', 'create-outline'],
    ['analytics', 'Analytics', 'bar-chart-outline']
  ];
  const tabs = role === 'patient' ? patientTabs : doctorTabs;

  return (
    <View style={[styles.nav, insetBottom ? { paddingBottom: insetBottom } : null]}>
      {tabs.map(([key, label, icon]) => (
        <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)}>
          <View>
            <Ionicons name={icon} size={22} color={activeTab === key ? colors.sage : colors.muted} />
            {key === 'queue' && pending ? <View style={styles.badge}><Text style={styles.badgeText}>{pending}</Text></View> : null}
          </View>
          <Text style={[styles.navText, activeTab === key && styles.navTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Hero({ eyebrow, title, subtitle, pill }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      <Text style={styles.heroPill}>{pill}</Text>
    </View>
  );
}

function StatRow({ stats }) {
  return <FlatList horizontal showsHorizontalScrollIndicator={false} data={stats} keyExtractor={(item) => item.label} contentContainerStyle={styles.statRow} renderItem={({ item }) => <View style={styles.statCard}><Text style={styles.statValue}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text><Text style={styles.statTag}>{item.tag}</Text></View>} />;
}

function Section({ title, children }) {
  return <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Feature({ icon, text, light }) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={18} color={light ? '#fff' : colors.sage} />
      <Text style={[styles.featureText, light && styles.featureTextLight]}>{text}</Text>
    </View>
  );
}

function TaskRow({ text, done, onRemove }) {
  return (
    <View style={styles.taskRow}>
      <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? colors.sage : colors.muted} />
      <Text style={[styles.taskText, done && styles.taskTextDone]}>{text}</Text>
      <Pressable style={styles.taskRemove} onPress={onRemove}>
        <Ionicons name="close" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function Field({ label, style, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.field, props.multiline && styles.fieldMultiline, style]} placeholderTextColor={colors.muted} {...props} />
    </View>
  );
}

function PageHeader({ title, subtitle }) {
  return <View style={styles.pageHeader}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.subText}>{subtitle}</Text></View>;
}

function OptionRow({ label, value, options, onChange }) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <Pressable key={option} style={[styles.option, value === option && styles.optionActive]} onPress={() => onChange(option)}>
            <Text style={[styles.optionText, value === option && styles.optionTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DayDot({ day, done, today }) {
  return (
    <View style={[styles.dayDot, done && styles.dayDotDone, today && styles.dayDotToday]}>
      {done ? (
        <Ionicons name="checkmark" size={14} color="#fff" />
      ) : (
        <Text style={styles.dayDotText}>{day}</Text>
      )}
    </View>
  );
}

function Note({ note }) {
  return <View style={[styles.note, note.tone === 'gold' && styles.noteGold]}><Text style={styles.noteTitle}>{note.title}</Text><Text style={styles.noteBody}>{note.body}</Text></View>;
}

function Legend({ color, label }) {
  return <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function BbtBar({ temp }) {
  const height = 28 + (temp - 36.3) * 90;
  return <View style={styles.barWrap}><View style={[styles.bar, { height, backgroundColor: temp >= 36.8 ? colors.blush : colors.sage }]} /><Text style={styles.barText}>{temp.toFixed(1)}</Text></View>;
}

function Phase({ phase }) {
  return <View style={[styles.phase, phase.status === 'done' && styles.phaseDone, phase.status === 'current' && styles.phaseCurrent]}><Text style={styles.phaseKicker}>{phase.status}</Text><Text style={styles.phaseTitle}>{phase.title}</Text><Text style={styles.subText}>{phase.body}</Text></View>;
}

function BreathingCard() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('Tap to start');

  useEffect(() => {
    if (!running) return undefined;
    const steps = ['Inhale', 'Hold', 'Exhale'];
    let index = 0;
    setStep(steps[index]);
    const timer = setInterval(() => {
      index = (index + 1) % steps.length;
      setStep(steps[index]);
    }, 4000);
    return () => clearInterval(timer);
  }, [running]);

  return (
    <Pressable style={styles.breathCard} onPress={() => setRunning((value) => !value)}>
      <View style={[styles.breathCircle, running && styles.breathCircleActive]}><Text style={styles.breathText}>{step}</Text></View>
      <Text style={styles.subText}>4-7-8 breathing for nervous-system calm.</Text>
    </Pressable>
  );
}

function PatientRow({ patient, onPress }) {
  return (
    <Pressable style={styles.patientRow} onPress={onPress}>
      <View style={styles.patientAvatar}><Text style={styles.patientAvatarText}>{patient.name.split(' & ').map((part) => part[0]).join('')}</Text></View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.subText}>{patient.package} package - Week {patient.week}</Text>
      </View>
      <Text style={styles.statusText}>{patient.status}</Text>
    </Pressable>
  );
}

function CheckinCard({ item, onSend, compact }) {
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <Text style={styles.patientName}>{item.name}</Text>
      <Text style={styles.subText}>Week {item.week} check-in - {item.status}</Text>
      <Text style={styles.checkinSummary}>{item.summary}</Text>
      {item.status === 'pending' ? (
        <Pressable style={styles.secondaryButton} onPress={onSend}>
          <Ionicons name="send-outline" size={18} color={colors.sage} />
          <Text style={styles.secondaryButtonText}>Send Response</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PatientModal({ patient, onClose }) {
  return (
    <Modal visible={Boolean(patient)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={styles.modal}>
          <View style={styles.modalHandle} />
          <Text style={styles.pageTitle}>{patient?.name}</Text>
          <Text style={styles.subText}>{patient?.package} package - Week {patient?.week} of 8</Text>
          <View style={styles.rowBetween}><Text style={styles.rowLabel}>Main concern</Text><Text style={styles.rowValue}>{patient?.concern}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.rowLabel}>Trying since</Text><Text style={styles.rowValue}>{patient?.tryingSince}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.rowLabel}>Status</Text><Text style={styles.rowValue}>{patient?.status}</Text></View>
          <Pressable style={styles.primaryButton} onPress={onClose}><Text style={styles.primaryButtonText}>Close</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileModal({ user, role, visible, onClose, onSignOut }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <Pressable style={[styles.modal, { paddingBottom: 40 }]}>
          <View style={styles.modalHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <View style={[styles.avatar, { width: 60, height: 60, borderRadius: 30 }]}>
              <Text style={[styles.avatarText, { fontSize: 24 }]}>{user?.avatar || 'LN'}</Text>
            </View>
            <View>
              <Text style={styles.pageTitle}>{user?.name}</Text>
              <Text style={styles.subText}>{role === 'patient' ? `${user?.package || 'Program'} Package` : 'Care Team'}</Text>
            </View>
          </View>
          
          {role === 'patient' && (
            <>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Program Week</Text><Text style={styles.rowValue}>{user?.week || 1}</Text></View>
              <View style={styles.rowBetween}><Text style={styles.rowLabel}>Cycle Day</Text><Text style={styles.rowValue}>{user?.cycleDay || 1}</Text></View>
            </>
          )}
          <View style={styles.rowBetween}><Text style={styles.rowLabel}>Account Email</Text><Text style={styles.rowValue}>{user?.email || 'test@luminest.com'}</Text></View>
          
          <Pressable style={[styles.primaryButton, { marginTop: 24, backgroundColor: colors.blush }]} onPress={onSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Sign Out</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  loginHero: { backgroundColor: colors.sageDark, paddingHorizontal: 28, paddingTop: 56, paddingBottom: 36, alignItems: 'center' },
  logo: { fontSize: 40, fontWeight: '800', color: '#fff' },
  logoAccent: { color: '#c8e6ca' },
  loginTagline: { color: 'rgba(255,255,255,0.78)', marginTop: 10, textAlign: 'center', lineHeight: 21 },
  loginBody: { flex: 1, backgroundColor: colors.warm, paddingHorizontal: 24, paddingTop: 28, gap: 16 },
  helperText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  subText: { color: colors.mid, fontSize: 13, lineHeight: 20 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: colors.charcoal, fontWeight: '700', marginBottom: 6 },
  field: { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.charcoal },
  fieldMultiline: { minHeight: 90, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: colors.sage, minHeight: 48, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { backgroundColor: colors.warm, borderWidth: 1.5, borderColor: colors.border, minHeight: 46, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 4 },
  secondaryButtonText: { color: colors.sage, fontWeight: '800' },
  topbar: { minHeight: 60, paddingHorizontal: 16, backgroundColor: colors.warm, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  topLogo: { color: colors.sage, fontSize: 24, fontWeight: '800' },
  topLogoAccent: { color: colors.blush },
  topActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.sagePale },
  resetText: { color: colors.sage, fontSize: 12, fontWeight: '800' },
  smallMode: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  smallModeActive: { backgroundColor: colors.sagePale },
  smallModeText: { color: colors.mid, fontSize: 12, fontWeight: '700' },
  smallModeTextActive: { color: colors.sage },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  content: { flex: 1 },
  contentInner: { paddingBottom: 24 },
  hero: { margin: 16, padding: 20, borderRadius: 20, backgroundColor: colors.sageDark },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 27, fontWeight: '800', lineHeight: 33, marginTop: 4 },
  heroPill: { alignSelf: 'flex-start', marginTop: 12, color: '#fff', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  statRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 10 },
  statCard: { width: 130, backgroundColor: colors.warm, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  statValue: { fontSize: 30, fontWeight: '800', color: colors.charcoal },
  statLabel: { color: colors.mid, fontSize: 12, marginTop: 2 },
  statTag: { alignSelf: 'flex-start', marginTop: 8, color: colors.sage, backgroundColor: colors.sagePale, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  card: { marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.warm, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  compactCard: { marginHorizontal: 0 },
  sectionTitle: { fontSize: 14, color: colors.charcoal, fontWeight: '800', marginBottom: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 5 },
  featureText: { color: colors.charcoal, fontSize: 14, flex: 1, lineHeight: 20 },
  featureTextLight: { color: 'rgba(255,255,255,0.88)' },
  streakRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  dayDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dayDotDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  dayDotToday: { backgroundColor: colors.blushPale, borderColor: colors.blush },
  dayDotText: { color: colors.mid, fontSize: 11, fontWeight: '800' },
  dayDotTextActive: { color: '#fff' },
  pageHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.charcoal, marginBottom: 4 },
  rowSplit: { flexDirection: 'row', gap: 12 },
  rowInput: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  inlineInput: { flex: 1, backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.charcoal },
  smallButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  optionBlock: { marginBottom: 16 },
  optionLabel: { fontSize: 13, fontWeight: '800', color: colors.charcoal, marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.cream },
  optionActive: { backgroundColor: colors.sage, borderColor: colors.sage },
  optionText: { color: colors.mid, fontWeight: '700' },
  optionTextActive: { color: '#fff' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  taskText: { color: colors.charcoal, fontSize: 14, flex: 1, lineHeight: 20 },
  taskTextDone: { color: colors.sage },
  taskRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  note: { borderLeftWidth: 4, borderLeftColor: colors.sage, backgroundColor: colors.sagePale, borderRadius: 12, padding: 14, marginBottom: 10 },
  noteGold: { borderLeftColor: colors.gold, backgroundColor: colors.goldPale },
  noteTitle: { color: colors.charcoal, fontWeight: '800', marginBottom: 4 },
  noteBody: { color: colors.charcoal, fontSize: 13, lineHeight: 20 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calendarDay: { width: '12.4%', aspectRatio: 1, borderRadius: 22, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  periodDay: { backgroundColor: colors.blush },
  fertileDay: { backgroundColor: colors.sage },
  ovulationDay: { backgroundColor: colors.gold },
  currentDay: { borderWidth: 2, borderColor: colors.charcoal },
  calendarText: { color: colors.mid, fontSize: 12, fontWeight: '700' },
  calendarTextActive: { color: '#fff' },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.mid, fontSize: 12 },
  chart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 4 },
  barText: { color: colors.mid, fontSize: 9 },
  phase: { borderLeftWidth: 4, borderLeftColor: colors.border, paddingLeft: 12, paddingVertical: 10 },
  phaseDone: { borderLeftColor: colors.sage },
  phaseCurrent: { borderLeftColor: colors.gold },
  phaseKicker: { color: colors.mid, fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  phaseTitle: { color: colors.charcoal, fontSize: 18, fontWeight: '800', marginVertical: 3 },
  breathCard: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  breathCircle: { width: 142, height: 142, borderRadius: 71, borderWidth: 3, borderColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  breathCircleActive: { backgroundColor: colors.sagePale, transform: [{ scale: 1.05 }] },
  breathText: { color: colors.sage, fontWeight: '800', fontSize: 16 },
  patientRow: { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.warm, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sagePale, alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { color: colors.sage, fontWeight: '800' },
  patientInfo: { flex: 1 },
  patientName: { color: colors.charcoal, fontWeight: '800', fontSize: 15 },
  statusText: { color: colors.sage, fontSize: 12, fontWeight: '800', maxWidth: 86, textAlign: 'right' },
  checkinSummary: { color: colors.charcoal, lineHeight: 20, marginTop: 10, fontSize: 13 },
  progress: { height: 10, borderRadius: 10, backgroundColor: colors.sagePale, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: colors.sage },
  nav: { minHeight: 70, backgroundColor: colors.warm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  navTextActive: { color: colors.sage },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  modalScrim: { flex: 1, backgroundColor: 'rgba(42,40,37,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.warm, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 12 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, gap: 16 },
  rowLabel: { color: colors.mid },
  rowValue: { color: colors.charcoal, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 86, backgroundColor: colors.charcoal, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontWeight: '700' },
  authContainer: { flex: 1, backgroundColor: colors.sageDark },
  authContent: { paddingHorizontal: 24, paddingVertical: 40 },
  authForm: { marginBottom: 32 },
  authInput: { backgroundColor: colors.cream, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, fontSize: 14, color: colors.charcoal, borderWidth: 1.5, borderColor: colors.border },
  authButton: { backgroundColor: colors.sage, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { color: colors.cream, fontSize: 16, fontWeight: '800' },
  toggleText: { color: colors.sagePale, fontSize: 14, textAlign: 'center', textDecorationLine: 'underline', marginTop: 12 },
  warningBox: { backgroundColor: colors.goldPale, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, marginTop: 24 },
  warningText: { flex: 1, fontSize: 13, color: colors.charcoal, lineHeight: 18 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 18, marginTop: 2 },
  pillTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, fontSize: 11, fontWeight: '600', overflow: 'hidden' },
  calNavBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warm },
  calNavText: { fontSize: 18, color: colors.charcoal, fontWeight: '700' },
  calHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  calHeaderText: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 0.4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '700', color: colors.charcoal }
});
