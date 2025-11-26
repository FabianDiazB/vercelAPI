import admin from 'firebase-admin';

// Inicializar Firebase Admin directamente con variables de entorno
// Vercel inyecta las variables automáticamente
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "p1redes-f05f2",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@p1redes-f05f2.iam.gserviceaccount.com",
      client_id: process.env.FIREBASE_CLIENT_ID || "117978534751885735497",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40p1redes-f05f2.iam.gserviceaccount.com",
      universe_domain: "googleapis.com"
    })
  });
}

const bd = admin.firestore();

export { admin, bd };
