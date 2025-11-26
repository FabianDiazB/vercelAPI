import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bd } from './firebase.js';
import { authRouter } from './rutas/auth.js';
import { dominiosRouter } from './rutas/dominios.js';

dotenv.config();

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/dominios', dominiosRouter);

app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok', mensaje: 'API funcionando correctamente' });
});

app.get('/api/obtener-pais', async (req, res) => {
  try {
    const { ip } = req.query;
    if (!ip) {
      return res.status(400).json({ exito: false, error: 'IP requerida' });
    }

    const ipNumero = ipANumero(ip);
    
    // Obtener todos los rangos de ip to coutry
    const snapshot = await bd.collection('ip_to_country').get();
    
    let paisEncontrado = null;
    snapshot.forEach(doc => {
      const datos = doc.data();
      // Los datos de Firebase ya vienen con inicio/fin como números y pais como string
      if (datos.inicio <= ipNumero && ipNumero <= datos.fin) {
        paisEncontrado = datos.pais;
      }
    });

    if (!paisEncontrado) {
      return res.json({ exito: false, pais: null });
    }

    res.json({ exito: true, pais: paisEncontrado });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.get('/api/obtener-cache-zonal', async (req, res) => {
  try {
    const { pais, dominio } = req.query;
    if (!pais) {
      return res.status(400).json({ exito: false, error: 'Pais requerido' });
    }

    // Mapeo de países sin cache a países con cache cercano
    const mapeo_paises = {
      'MX': 'US',  // México -> USA 
      'AR': 'BR',  // Argentina 
      'CL': 'BR',  // Chile -> 
      'PE': 'BR',  // Perú -> Brasil
      'CO': 'US',  // Colombia -> USA
      'VE': 'US',  // Venezuela -> USA
      'EC': 'BR',  // Ecuador -> Brasil
      'UY': 'BR',  // Uruguay -> Brasil
      'PY': 'BR',  // Paraguay -> Brasil
      'BO': 'BR',  // Bolivia -> Brasil
      'PA': 'US',  // Panamá -> USA
      'GT': 'US',  // Guatemala -> USA
      'HN': 'US',  // Honduras -> USA
      'SV': 'US',  // El Salvador -> USA
      'NI': 'US',  // Nicaragua -> USA
      'DO': 'US',  // República Dominicana -> USA
      'CU': 'US',  // Cuba -> USA
      'PR': 'US',  // Puerto Rico -> USA
      'FR': 'ES',  // Francia -> España
      'IT': 'ES',  // Italia -> España
      'PT': 'ES',  // Portugal -> España
      'GB': 'ES',  // Reino Unido -> España
      'NL': 'DE',  // Países Bajos -> Alemania
      'BE': 'DE',  // Bélgica -> Alemania
      'CH': 'DE',  // Suiza -> Alemania
      'AT': 'DE',  // Austria -> Alemania
      'CN': 'JP',  // China -> Japón
      'KR': 'JP',  // Corea -> Japón
      'TW': 'JP',  // Taiwán -> Japón
      'SG': 'JP',  // Singapur -> Japón
      'AU': 'JP',  // Australia -> Japón
      'NZ': 'JP',  // Nueva Zelanda -> Japón
      'IN': 'JP',  // India -> Japón
      'TH': 'JP',  // Tailandia -> Japón
      'VN': 'JP',  // Vietnam -> Japón
      'PH': 'JP',  // Filipinas -> Japón
      'ID': 'JP',  // Indonesia -> Japón
      'MY': 'JP',  // Malasia -> Japón
      'CA': 'US',  // Canadá -> USA
    };

    // Si el país no tiene cache directo, usar el mapeo
    const pais_cache = mapeo_paises[pais] || pais;

    const snapshot = await bd.collection('caches_zonales')
      .where('pais', '==', pais_cache)
      .where('activo', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`[Cache Zonal] No se encontró cache para ${pais} (mapeado a ${pais_cache})`);
      return res.json({ exito: false, ip_cache: null });
    }

    const datos = snapshot.docs[0].data();
    console.log(`[Cache Zonal] ${pais} -> ${pais_cache} -> ${datos.ip}:${datos.puerto}`);
    res.json({ 
      exito: true, 
      ip_cache: datos.ip,
      puerto: datos.puerto || 80,
      pais_origen: pais,
      pais_cache: pais_cache
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.get('/api/ip-to-country', async (req, res) => {
  try {
    const snapshot = await bd.collection('ip_to_country').get();
    const rangos = [];
    
    snapshot.forEach(doc => {
      const datos = doc.data();
      rangos.push({
        id: doc.id,
        ip_inicio: numeroAIp(datos.inicio),
        ip_fin: numeroAIp(datos.fin),
        codigo_pais: datos.pais,
        nombre_pais: obtenerNombrePais(datos.pais)
      });
    });
    
    res.json({ exito: true, rangos });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.post('/api/validar-api-key', async (req, res) => {
  try {
    const { dominio, api_key } = req.body;
    
    if (!dominio || !api_key) {
      return res.status(400).json({ exito: false, error: 'Dominio y API key requeridos' });
    }

    // Buscar en la colección raíz api_keys
    const keysSnapshot = await bd.collection('api_keys')
      .where('key', '==', api_key)
      .where('dominio', '==', dominio)
      .where('activa', '==', true)
      .limit(1)
      .get();

    if (keysSnapshot.empty) {
      return res.json({ exito: false, valida: false, error: 'API key inválida para este dominio' });
    }

    res.json({ exito: true, valida: true });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Registro de nuevo usuario
app.post('/api/registrar-usuario', async (req, res) => {
  try {
    const { usuario, password, nombre } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({ exito: false, mensaje: 'Usuario y contraseña requeridos' });
    }

    // Verificar si el usuario ya existe
    const existeSnapshot = await bd.collection('users')
      .where('usuario', '==', usuario)
      .limit(1)
      .get();

    if (!existeSnapshot.empty) {
      return res.status(400).json({ exito: false, mensaje: 'El usuario ya existe' });
    }

    // Crear nuevo usuario
    const nuevoUsuario = {
      usuario: usuario,
      password: password,
      nombre: nombre || usuario,
      activo: true,
      creado: new Date().toISOString()
    };

    await bd.collection('users').add(nuevoUsuario);
    
    const sesion = generarToken();
    res.json({ exito: true, mensaje: 'Usuario creado exitosamente', sesion });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// Validar usuario/password
app.post('/api/validar-usuario', async (req, res) => {
  try {
    console.log('[Login] Request body:', req.body);
    const { usuario, contrasena } = req.body;
    if (!usuario || !contrasena) {
      console.log('[Login] Datos incompletos');
      return res.status(400).json({ exito: false, mensaje: 'Usuario y contraseña requeridos' });
    }

    console.log('[Login] Buscando usuario:', usuario);
    const usersSnapshot = await bd.collection('users')
      .where('usuario', '==', usuario)
      .where('activo', '==', true)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('[Login] Usuario no encontrado');
      return res.json({ exito: false, valido: false, mensaje: 'Usuario no encontrado' });
    }

    const userData = usersSnapshot.docs[0].data();
    const valido = userData.password === contrasena;
    console.log('[Login] Validación:', valido);

    if (valido) {
      res.json({ exito: true, valido: true, sesion: generarToken() });
    } else {
      res.json({ exito: false, valido: false, mensaje: 'Contraseña incorrecta' });
    }
  } catch (error) {
    console.error('[Login] Error:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.post('/api/validar-sesion', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ exito: false, valida: false, error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    
    // Por ahora validamos que el token exista y no esté vacío
    if (token && token.length > 10) {
      return res.json({ exito: true, valida: true });
    }
    
    res.json({ exito: true, valida: false });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.post('/api/dominios', async (req, res) => {
  try {
    const { nombre, servidor_origen } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ exito: false, error: 'Nombre de dominio requerido' });
    }

    // Si no se especifica servidor_origen, usar el dominio mismo (para sitios externos)
    // Si se especifica, usar ese valor (para backends internos como apache-server)
    const origenFinal = servidor_origen && servidor_origen.trim() !== '' 
      ? servidor_origen 
      : `http://${nombre}`;

    const dominioRef = bd.collection('dominios').doc(nombre);
    await dominioRef.set({
      nombre,
      propietario_id: 'admin', // TODO: obtener de token JWT
      verificado: false,
      txt_record: `verify-${Date.now()}`,
      servidor_origen: origenFinal,
      created_at: new Date()
    });

    res.json({ exito: true, dominio: nombre, servidor_origen: origenFinal });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.get('/api/configuracion-dominio', async (req, res) => {
  try {
    const { dominio } = req.query;
    if (!dominio) {
      return res.status(400).json({ exito: false, error: 'Dominio requerido' });
    }

    // Primero buscar en registros_dns (configuración de enrutamiento)
    const registroDnsDoc = await bd.collection('registros_dns').doc(dominio).get();
    
    if (registroDnsDoc.exists) {
      const dnsConfig = registroDnsDoc.data();
      
      // Construir servidor_origen desde las IPs configuradas
      let servidor_origen = null;
      if (dnsConfig.ips && dnsConfig.ips.length > 0) {
        const puerto = dnsConfig.health_check?.puerto || 80;
        servidor_origen = `http://${dnsConfig.ips[0]}:${puerto}`;
      }
      
      return res.json({ 
        exito: true, 
        configuracion: {
          nombre: dominio,
          servidor_origen: servidor_origen,
          tipo: dnsConfig.tipo,
          ips: dnsConfig.ips,
          health_check: dnsConfig.health_check
        }
      });
    }

    // Si no está en registros_dns, buscar en dominios (legacy)
    const snapshot = await bd.collection('dominios')
      .where('nombre', '==', dominio)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ exito: false, configuracion: null });
    }

    const datos = snapshot.docs[0].data();
    const urlsSnapshot = await snapshot.docs[0].ref.collection('urls').get();
    const urls = [];

    urlsSnapshot.forEach(doc => {
      urls.push({ id: doc.id, ...doc.data() });
    });

    res.json({ 
      exito: true, 
      configuracion: {
        nombre: datos.nombre,
        verificado: datos.verificado || false,
        servidor_origen: datos.servidor_origen || null,
        urls: urls
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

function numeroAIp(numero) {
  return [
    (numero >> 24) & 255,
    (numero >> 16) & 255,
    (numero >> 8) & 255,
    numero & 255
  ].join('.');
}

function ipANumero(ip) {
  const partes = ip.split('.');
  return ((parseInt(partes[0]) << 24) + 
         (parseInt(partes[1]) << 16) + 
         (parseInt(partes[2]) << 8) + 
         parseInt(partes[3])) >>> 0; // >>> 0 convierte a unsigned 32-bit
}

function obtenerNombrePais(codigo) {
  const paises = {
    'CR': 'Costa Rica',
    'US': 'Estados Unidos',
    'ES': 'España',
    'BR': 'Brasil',
    'DE': 'Alemania',
    'JP': 'Japón'
  };
  return paises[codigo] || codigo;
}

function generarToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
  app.listen(puerto, () => {
    console.log(`API escuchando en puerto ${puerto}`);
  });
}

// Para Vercel (export default es requerido)
export default app;
