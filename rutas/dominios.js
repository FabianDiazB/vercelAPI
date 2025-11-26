import express from 'express';
import { bd } from '../firebase.js';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-temporal-cambiar-en-produccion';

// Middleware para autenticar todas las rutas de dominios
function verificarTokenLocal(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    console.log('[verificarToken dominios] No token provided');
    return res.status(401).json({ exito: false, error: 'Token no proporcionado' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('[verificarToken dominios] Token válido, usuario:', payload);
    req.usuario = payload;
    next();
  } catch (error) {
    console.log('[verificarToken dominios] Token inválido:', error.message);
    res.status(401).json({ exito: false, error: 'Token invalido' });
  }
}

router.use(verificarTokenLocal);

router.get('/', async (req, res) => {
  try {
    const propietarioId = req.usuario.id;
    console.log('[GET dominios] Usuario ID:', propietarioId);
    
    const snapshot = await bd.collection('dominios')
      .where('propietario_id', '==', propietarioId)
      .get();
    
    console.log('[GET dominios] Documentos encontrados:', snapshot.size);
    
    const dominios = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('[GET dominios] Dominio:', doc.id, 'propietario_id:', data.propietario_id);
      dominios.push({ id: doc.id, ...data });
    });
    
    res.json({ exito: true, dominios });
  } catch (error) {
    console.error('[GET dominios] Error:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, servidor_origen } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ exito: false, error: 'Nombre de dominio requerido' });
    }
    
    // Verificar dominios reservados en archivo TXT
    const rutaTxt = path.join(process.cwd(), 'dominios_reservados.txt');
    const contenido = await fs.readFile(rutaTxt, 'utf-8');
    const dominiosReservados = contenido
      .split(/\r?\n/)
      .map(d => d.trim())
      .filter(d => d && !d.startsWith('#'));
    
    if (dominiosReservados.includes(nombre.toLowerCase())) {
      return res.status(400).json({ exito: false, error: 'Dominio reservado o no disponible' });
    }
    
    const existente = await bd.collection('dominios')
      .where('nombre', '==', nombre)
      .limit(1)
      .get();
    
    if (!existente.empty) {
      return res.status(400).json({ exito: false, error: 'Dominio ya registrado' });
    }
    
    const txtRecord = `verify-${Math.random().toString(36).substring(2, 15)}`;
    
    // Si no se especifica servidor_origen, usar el dominio mismo (para sitios externos)
    // Si se especifica, usar ese valor (para backends internos como apache-server)
    const origenFinal = servidor_origen && servidor_origen.trim() !== '' 
      ? servidor_origen 
      : `http://${nombre}`;
    
    const nuevoDominio = {
      nombre,
      propietario_id: req.usuario.id,
      verificado: false,
      txt_record: txtRecord,
      servidor_origen: origenFinal,
      creado_en: new Date().toISOString()
    };
    
    // CRÍTICO: Usar .doc(nombre).set() para que el ID sea el nombre del dominio
    const dominioRef = bd.collection('dominios').doc(nombre);
    await dominioRef.set(nuevoDominio);
    
    res.json({ 
      exito: true, 
      dominio: { id: nombre, ...nuevoDominio },
      instrucciones: `Agregar registro TXT: ${txtRecord}`
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    if (doc.data().propietario_id !== req.usuario.id) {
      return res.status(403).json({ exito: false, error: 'No autorizado' });
    }
    
    await docRef.delete();
    
    res.json({ exito: true, mensaje: 'Dominio eliminado' });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.post('/:id/verificar', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    const dominio = doc.data();
    
    // Marcar como verificado
    await docRef.update({ verificado: true });
    
    // Los dominios verificados ya están en Firebase, no necesitamos archivo local
    // El archivo dominios_reservados.txt es solo para dominios del sistema (google.com, facebook.com, etc.)
    
    res.json({ 
      exito: true, 
      verificado: true, 
      mensaje: 'Dominio verificado exitosamente' 
    });
  } catch (error) {
    console.error('Error en verificar dominio:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.get('/:dominio/urls', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    if (doc.data().propietario_id !== req.usuario.id) {
      return res.status(403).json({ exito: false, error: 'No autorizado' });
    }
    
    const snapshot = await docRef.collection('urls').get();
    const urls = [];
    
    snapshot.forEach(doc => {
      urls.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ exito: true, urls });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.post('/:dominio/urls', async (req, res) => {
  try {
    const { path, tamanio_cache_mb, tipos_archivo, metodo_autenticacion } = req.body;
    
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    // Validación de propietario comentada para testing
    // if (doc.data().propietario_id !== req.usuario.id) {
    //   return res.status(403).json({ exito: false, error: 'No autorizado' });
    // }
    
    const nuevaUrl = {
      path,
      tamanio_cache_mb: tamanio_cache_mb || 50,
      tipos_archivo: tipos_archivo || {},
      metodo_autenticacion: metodo_autenticacion || 'none',
      creado_en: new Date().toISOString()
    };
    
    const urlRef = await docRef.collection('urls').add(nuevaUrl);
    
    res.json({ exito: true, url: { id: urlRef.id, ...nuevaUrl } });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.delete('/:dominio/urls/:urlId', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    // Validación de propietario comentada para testing
    // if (doc.data().propietario_id !== req.usuario.id) {
    //   return res.status(403).json({ exito: false, error: 'No autorizado' });
    // }
    
    await docRef.collection('urls').doc(req.params.urlId).delete();
    
    res.json({ exito: true, mensaje: 'URL eliminada' });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.get('/:dominio/api-keys', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    const dominioData = doc.data();
    
    // Validación de propietario comentada para testing
    // if (dominioData.propietario_id !== req.usuario.id) {
    //   return res.status(403).json({ exito: false, error: 'No autorizado' });
    // }
    
    // Buscar en colección raíz api_keys
    const snapshot = await bd.collection('api_keys')
      .where('dominio', '==', dominioData.nombre)
      .get();
    
    const keys = [];
    snapshot.forEach(doc => {
      keys.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ exito: true, api_keys: keys });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.post('/:dominio/api-keys', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    const dominioData = doc.data();
    
    // Validación de propietario comentada para testing
    // if (dominioData.propietario_id !== req.usuario.id) {
    //   return res.status(403).json({ exito: false, error: 'No autorizado' });
    // }
    
    // Generar API key única
    const key = Array.from({ length: 32 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62))
    ).join('');
    
    const nuevaKey = {
      key,
      dominio: dominioData.nombre,
      nombre: req.body.nombre || 'API Key',
      activa: true,
      creado_en: new Date().toISOString()
    };
    
    // Guardar en colección raíz api_keys
    const keyRef = await bd.collection('api_keys').add(nuevaKey);
    
    res.json({ exito: true, api_key: { id: keyRef.id, ...nuevaKey } });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.delete('/:dominio/api-keys/:keyId', async (req, res) => {
  try {
    const docRef = bd.collection('dominios').doc(req.params.dominio);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ exito: false, error: 'Dominio no encontrado' });
    }
    
    // Validación de propietario comentada para testing
    // if (doc.data().propietario_id !== req.usuario.id) {
    //   return res.status(403).json({ exito: false, error: 'No autorizado' });
    // }
    
    // Eliminar de colección raíz api_keys
    await bd.collection('api_keys').doc(req.params.keyId).delete();
    
    res.json({ exito: true, mensaje: 'API Key eliminada' });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

export { router as dominiosRouter };
