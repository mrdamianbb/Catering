const securityHeaders=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
  {key:"Cache-Control",value:"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"},
  {key:"Content-Security-Policy",value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com"}
];
export default {async headers(){return [{source:"/:path*",headers:securityHeaders}]}};