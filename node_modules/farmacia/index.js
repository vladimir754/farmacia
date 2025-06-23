const express = require('express');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session');
const multer = require('multer');

const app = express();

// Middleware global
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuración de sesiones
app.use(session({
  secret: 'secreto_farmacia_123',
  resave: false,
  saveUninitialized: true
}));

// Conexión MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'farmacia'
});

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos MySQL');
});

// Configuración de multer para la carga de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));  // Ruta donde se almacenarán las imágenes
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);  // Obtiene la extensión de la imagen
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext; // Genera un nombre único
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Middleware de autenticación
function isAuth(req, res, next) {
  if (req.session.usuario) return next();
  res.redirect('/sesion');
}

// === RUTAS GET ===
app.get('/sesion', (req, res) => {
  res.render('sesion', { mensaje: null });
});

app.get('/registro', (req, res) => {
  res.render('registro');
});

app.get('/menu', isAuth, (req, res) => {
  res.render('menu');
});

app.get('/carrito', isAuth, (req, res) => {
  res.render('carrito');
});

app.get('/contacto', (req, res) => {
  res.render('contacto');
});


//promociones 
app.get('/promociones', (req,res)=>{
  res.render('promociones');
});

app.get('/perfil', isAuth, (req, res) => {
  const correo = req.session.usuario;
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) return res.status(500).send('Error obteniendo perfil');
    if (!results.length) return res.status(404).send('Usuario no encontrado');
    res.render('perfil', { usuario: results[0] });
  });
});

app.get('/editar-perfil', isAuth, (req, res) => {
  const correo = req.session.usuario;
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) return res.status(500).send('Error obteniendo datos');
    if (!results.length) return res.status(404).send('Usuario no encontrado');
    res.render('editar-perfil', { usuario: results[0] });
  });
});

// === RUTAS POST ===
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/sesion');
});

app.post('/registro', (req, res) => {
  const { nombre, usuario, contra } = req.body;
  if (!nombre || !usuario || !contra) {
    return res.status(400).send('Todos los campos son obligatorios');
  }

  const sqlCheck = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sqlCheck, [usuario], (err, results) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (results.length > 0) return res.send('El usuario ya existe');

    const sqlInsert = 'INSERT INTO usuarios (nombre, correo, contra) VALUES (?, ?, ?)';
    db.query(sqlInsert, [nombre, usuario, contra], err => {
      if (err) return res.status(500).send('Error registrando usuario');
      res.redirect('/sesion');
    });
  });
});

app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.render('sesion', { mensaje: 'Ingresa correo y contraseña' });
  }

  const sql = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sql, [usuario], (err, results) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (!results.length) {
      return res.render('sesion', { mensaje: 'Usuario no encontrado' });
    }

    const user = results[0];
    if (password !== user.contra) {
      return res.render('sesion', { mensaje: 'Contraseña incorrecta' });
    }

    req.session.usuario = user.correo;
    res.redirect('/menu');
  });
});

// Ruta para actualizar la foto de perfil
app.post('/subir-foto', isAuth, upload.single('foto'), (req, res) => {
  const correo = req.session.usuario;
  const foto = req.file.filename;  // El nombre del archivo subido
  const sql = 'UPDATE usuarios SET foto = ? WHERE correo = ?';

  db.query(sql, [foto, correo], (err) => {
    if (err) return res.status(500).send('Error actualizando foto de perfil');
    res.redirect('/perfil');
  });
});

// Ruta para eliminar la foto de perfil
app.post('/eliminar-foto', isAuth, (req, res) => {
  const correo = req.session.usuario;
  
  // Primero, obtener el nombre del archivo de la base de datos
  db.query('SELECT foto FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) return res.status(500).send('Error obteniendo datos');
    if (!results.length) return res.status(404).send('Usuario no encontrado');

    const foto = results[0].foto;

    // Eliminar el archivo físico de la carpeta uploads
    const fs = require('fs');
    const filePath = path.join(__dirname, 'public', 'uploads', foto);
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).send('Error eliminando la foto de perfil');
      
      // Borrar la foto de la base de datos
      db.query('UPDATE usuarios SET foto = NULL WHERE correo = ?', [correo], (err) => {
        if (err) return res.status(500).send('Error actualizando foto en la base de datos');
        res.redirect('/perfil');
      });
    });
  });
});


app.post('/actualizar-perfil', isAuth, (req, res) => {
  const correoActual = req.session.usuario;
  const { nombre, correo, contra } = req.body;

  if (!nombre || !correo || !contra) {
    return res.status(400).send('Faltan datos');
  }

  const sql = 'UPDATE usuarios SET nombre = ?, correo = ?, contra = ? WHERE correo = ?';
  db.query(sql, [nombre, correo, contra, correoActual], err => {
    if (err) return res.status(500).send('Error actualizando perfil');
    req.session.usuario = correo;
    res.redirect('/perfil');
  });
});

app.post('/enviar-contacto', (req, res) => {
  const { nombre, correo, asunto, mensaje } = req.body;

  if (!nombre || !correo || !asunto || !mensaje) {
    return res.status(400).send('Completa todos los campos del formulario');
  }

  const sql = 'INSERT INTO contacto (nombre, correo, asunto, mensaje) VALUES (?, ?, ?, ?)';
  db.query(sql, [nombre, correo, asunto, mensaje], err => {
    if (err) {
      console.error('❌ Error al guardar contacto:', err);
      return res.status(500).send('Error al enviar mensaje');
    }
    res.render('contacto-exito');
  });
});

// === Servidor en ejecución ===
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}/sesion`);
});
