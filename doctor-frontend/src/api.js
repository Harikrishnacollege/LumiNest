const getServerUrl = () => process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function api(path, opts = {}) {
  const res = await fetch(`${getServerUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const fetchDashboard = (doctorId) => api(`/dashboard?doctorId=${doctorId}`);
export const fetchPatients = (doctorId) => api(`/patients?doctorId=${doctorId}`);
export const fetchPatientDetail = (id) => api(`/patients/${id}`);
export const fetchCheckins = (doctorId) => api(`/checkins?doctorId=${doctorId}`);
export const respondCheckin = (id, body, doctorId) => api(`/checkins/${id}/respond`, { method: 'POST', body: { body, doctorId } });
export const fetchReports = (params = {}) => {
  const q = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('&');
  return api(`/reports?${q}`);
};
export const fetchNotes = (doctorId) => api(`/notes?doctorId=${doctorId}`);
export const createNote = (data) => api('/notes', { method: 'POST', body: data });
export const deleteNote = (id) => api(`/notes/${id}`, { method: 'DELETE' });
export const checkHealth = () => api('/health');
