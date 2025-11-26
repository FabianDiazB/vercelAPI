import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let claveServicio;

// En Vercel, usar variables de entorno
if (process.env.VERCEL || process.env.FIREBASE_PROJECT_ID) {
  // Validar que todas las variables existan
  const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  claveServicio = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };
} else {
  // Local/Kubernetes, usar archivo
  claveServicio = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
  );
}

admin.initializeApp({
  credential: admin.credential.cert(claveServicio)
});

const bd = admin.firestore();

export { admin, bd };
