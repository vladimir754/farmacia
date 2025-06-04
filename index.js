const express = require('express');
const path = require('path');
const mysql = require('mysql');
// const bcrypt = require('bcrypt'); // eliminado
const app = express();

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const session = require('express-session');

app.use(session({
  secret: 'secreto_farmacia_123', // puedes cambiarlo
  resave: false,
  saveUninitialized: true
}));


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'farmacia'
});

db.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos', err);
    process.exit(1);
  }
  console.log('Conectado a la base de datos MySQL');
});

app.get('/sesion', (req, res) => {
  res.render('sesion');
});

app.get('/registro', (req, res) => {
  res.render('registro');
});

app.get('/menu', (req, res) => {
  res.render('menu');
});

app.get('/carrito', (req,res) =>{
    res.render('carrito');
});

app.get('/contacto',(req,res)=>{
    res.render('contacto');
});
app.post('/logout', (req, res) => {
  // Aquí limpias la sesión si estás usando sesiones
  // Por ejemplo: req.session.destroy()
  res.redirect('/sesion');
});


app.get('/perfil', (req, res) => {
  const correo = req.session.usuario;

  if (!correo) {
    return res.redirect('/sesion'); // Si no está logueado
  }

  const sql = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sql, [correo], (err, results) => {
    if (err) return res.status(500).send('Error obteniendo perfil');
    if (results.length === 0) return res.status(404).send('Usuario no encontrado');

    const usuario = results[0];
    res.render('perfil', { usuario });
  });
});

app.get('/editar-perfil', (req, res) => {
  const correo = req.session.usuario;

  if (!correo) {
    return res.redirect('/sesion');
  }

  const sql = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sql, [correo], (err, results) => {
    if (err) return res.status(500).send('Error al obtener datos');
    if (results.length === 0) return res.status(404).send('Usuario no encontrado');

    res.render('editar-perfil', { usuario: results[0] });
  });
});

app.post('/actualizar-perfil', (req, res) => {
  const correoActual = req.session.usuario;
  const { nombre, correo, contra } = req.body;

  if (!correoActual) {
    return res.redirect('/sesion');
  }

  const sql = 'UPDATE usuarios SET nombre = ?, correo = ?, contra = ? WHERE correo = ?';
  db.query(sql, [nombre, correo, contra, correoActual], (err, result) => {
    if (err) return res.status(500).send('Error actualizando perfil');

    // Actualiza la sesión si cambió el correo
    req.session.usuario = correo;
    res.redirect('/perfil');
  });
});


app.post('/registro', (req, res) => {
  const { nombre, usuario, contra } = req.body;
  const sqlCheck = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sqlCheck, [usuario], (err, results) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (results.length > 0) return res.send('Usuario ya registrado');
    // Guardar contraseña tal cual (sin hash)
    const sqlInsert = 'INSERT INTO usuarios (nombre, correo, contra) VALUES (?, ?, ?)';
    db.query(sqlInsert, [nombre, usuario, contra], (err) => {
      if (err) return res.status(500).send('Error registrando usuario');
      res.redirect('/sesion');
    });
  });
});

app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const sql = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sql, [usuario], (err, results) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (results.length === 0) {
      return res.render('sesion', { mensaje: 'Usuario no encontrado. ¿Quieres registrarte?' });
    }
    const user = results[0];
    // Comparar contraseña tal cual (sin bcrypt)
    if (password !== user.contra) {
      return res.render('sesion', { mensaje: 'Contraseña incorrecta.' });
    }

    req.session.usuario = user.correo;
    res.redirect('/menu');
  });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Escuchando en http://localhost:${PORT}/sesion`);
});
