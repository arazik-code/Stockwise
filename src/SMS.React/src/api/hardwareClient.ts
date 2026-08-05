import axios from 'axios'

// Printer/scanner endpoints (labels, receipts diagnostics) only make sense against the API
// instance physically near the store's hardware - always the local bundled API, regardless of
// whether the main session is currently talking to the VPS or the local fallback (see the plan
// doc's Architecture Decision #4). Deliberately a separate, absolute-URL axios instance from
// api/client.ts's relative '/api' one, and deliberately carries no Authorization header - these
// routes are loopback-trusted server-side (LoopbackOnlyMiddleware) rather than JWT-protected.
export const hardwareApi = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
})
