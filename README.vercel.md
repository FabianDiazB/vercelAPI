# Node API para Vercel

Este es el backend Node.js que gestiona la interacción con Firebase/Firestore.

## Variables de Entorno Requeridas en Vercel

1. `JWT_SECRET`: Secret para tokens JWT
2. Firebase Service Account: Cargar `serviceAccountKey.json` como archivo en Vercel

## Endpoints

- `POST /api/auth/login` - Login de usuarios
- `POST /api/auth/registro` - Registro de usuarios
- `GET /api/dominios` - Listar dominios del usuario
- `POST /api/dominios` - Crear nuevo dominio
- `POST /api/dominios/:id/verificar` - Verificar dominio
- `GET /api/dominios/:dominio/api-keys` - Listar API keys
- `POST /api/dominios/:dominio/api-keys` - Generar API key
- `GET /api/configuracion-dominio` - Obtener config para cache
- `GET /api/obtener-pais` - Obtener país por IP
- `GET /api/obtener-cache-zonal` - Obtener cache zonal por país

## Deployment en Vercel

1. Conectar repositorio de GitHub
2. Configurar variables de entorno
3. Cargar serviceAccountKey.json en Settings > Environment Variables
4. Deploy automático en cada push
