import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { bd } from '../firebase.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-temporal-cambiar-en-produccion';

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    console.log('[verificarToken] No token provided');
    return res.status(401).json({ exito: false, error: 'Token no proporcionado' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('[verificarToken] Token válido, usuario:', payload);
    req.usuario = payload;
    next();
  } catch (error) {
    console.log('[verificarToken] Token inválido:', error.message);
    res.status(401).json({ exito: false, error: 'Token invalido' });
  }
}

router.post('/registro', async (req, res) => {
  try {
    const { email, password, nombre } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ exito: false, error: 'Email y password requeridos' });
    }
    
    const snapshot = await bd.collection('users')
      .where('usuario', '==', email)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      return res.status(400).json({ exito: false, error: 'Email ya registrado' });
    }
    
    const nuevoUsuario = {
      usuario: email,
      password: password,
      nombre: nombre || email.split('@')[0],
      creado: new Date().toISOString(),
      activo: true
    };
    
    const docRef = await bd.collection('users').add(nuevoUsuario);
    
    const token = jwt.sign({ id: docRef.id, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      exito: true, 
      usuario: { id: docRef.id, email, nombre: nuevoUsuario.nombre },
      token 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('[LOGIN] Intento de login:', { email, password });
    
    if (!email || !password) {
      return res.status(400).json({ exito: false, error: 'Email y password requeridos' });
    }
    
    const snapshot = await bd.collection('users')
      .where('usuario', '==', email)
      .where('activo', '==', true)
      .limit(1)
      .get();
    
    console.log('[LOGIN] Usuarios encontrados:', snapshot.size);
    
    if (snapshot.empty) {
      return res.status(401).json({ exito: false, error: 'Credenciales invalidas' });
    }
    
    const usuarioData = snapshot.docs[0].data();
    const usuarioId = snapshot.docs[0].id;
    
    console.log('[LOGIN] Usuario encontrado:', { usuario: usuarioData.usuario, password_bd: usuarioData.password, password_recibido: password });
    
    const passwordValido = usuarioData.password === password;
    
    console.log('[LOGIN] Password válido:', passwordValido);
    
    if (!passwordValido) {
      return res.status(401).json({ exito: false, error: 'Credenciales invalidas' });
    }
    
    const token = jwt.sign({ id: usuarioId, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      exito: true, 
      usuario: { id: usuarioId, email, nombre: usuarioData.nombre },
      token 
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    res.status(500).json({ exito: false, error: error.message });
  }
});

router.get('/perfil', async (req, res) => {
  try {
    // Sin autenticación por ahora - retornar usuario de prueba
    const usersSnapshot = await bd.collection('users')
      .where('activo', '==', true)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return res.status(404).json({ exito: false, error: 'Usuario no encontrado' });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const datos = userDoc.data();
    res.json({ 
      exito: true, 
      usuario: {
        id: userDoc.id,
        email: datos.email || datos.usuario,
        nombre: datos.nombre || datos.usuario,
        creado_en: datos.creado_en
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

export { router as authRouter, verificarToken };
