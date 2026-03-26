// API base URL — in dev, Vite proxy handles /api → localhost:4000
// In production (GitHub Pages), set VITE_API_URL to your VPS URL
const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return API_BASE + path;
}
