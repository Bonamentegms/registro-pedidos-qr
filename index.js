// index.js
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const path = require('path');

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Permitir todos los orígenes durante desarrollo
app.use(cors()); // 👈 Permite acceso desde cualquier origen temporalmente

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, 'menu.jpg');
  }
});
const upload = multer({ storage });

app.get('/menu.html', (req, res) => res.sendFile(path.join(__dirname, 'src', 'menu.html')));

app.post('/api/menu/imagen', upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna imagen' });
  }
  res.json({ message: '✅ Imagen del menú subida correctamente' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'form.html'));
});

app.post('/pedido', async (req, res) => {
  const { nombre, cedula, producto, cantidad, observacion } = req.body;
  try {
    const resultado = await pool.query('SELECT valor FROM inventario WHERE producto = $1 LIMIT 1', [producto]);
    const precioUnitario = resultado.rows[0]?.valor || 0;
    const preciototal = precioUnitario * parseInt(cantidad || 1);
    const fecha = new Date();

    await pool.query(
      'INSERT INTO pedidos (nombre, cedula, producto, precio, fecha, entregado, cantidad, observacion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [nombre.trim(), cedula.trim(), producto.trim(), preciototal, fecha, false, cantidad, observacion.trim()]
    );

    res.redirect(`/pedido.html?cedula=${encodeURIComponent(cedula.trim())}`);
  } catch (error) {
    console.error('❌ Error al guardar pedido:', error);
    res.status(500).send('Error al guardar el pedido');
  }
});

app.get('/api/pedido/:cedula', async (req, res) => {
  const { cedula } = req.params;
  try {
    const result = await pool.query('SELECT * FROM pedidos WHERE cedula = $1 ORDER BY fecha DESC LIMIT 1', [cedula]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró el pedido' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error al consultar el pedido:', err);
    res.status(500).json({ error: 'Error al consultar el pedido' });
  }
});

app.get('/api/inventario', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY producto ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// ... Resto del backend permanece igual


// Exportar inventario a Excel
app.get('/api/inventario/exportar', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY producto ASC');

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');

    worksheet.columns = [
      { header: 'Producto', key: 'producto', width: 30 },
      { header: 'Valor', key: 'valor', width: 15 }
    ];

    result.rows.forEach(p => {
      worksheet.addRow({
        producto: p.producto,
        valor: p.valor
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventario.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌ Error al exportar inventario:', error);
    res.status(500).send('Error al exportar inventario');
  }
});
// Actualizar producto del inventario
app.put('/api/inventario/:producto', async (req, res) => {
  const productoOriginal = req.params.producto;
  const { producto, valor } = req.body;
  console.log('📥 Producto original recibido:', productoOriginal);
  console.log('📥 Nuevo producto:', producto);
  console.log('📥 Nuevo valor:', valor);

  if (!producto || !valor) {
    return res.status(400).json({ error: 'Faltan datos del producto' });
  }

  try {
    await pool.query(
      'UPDATE inventario SET producto = $1, valor = $2 WHERE producto = $3',
      [producto.trim(), parseFloat(valor), productoOriginal.trim()]
    );
    res.json({ message: '✅ Producto actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar inventario:', error);
    res.status(500).json({ error: 'Error al actualizar inventario' });
  }
});

// Panel administrativo
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'admin.html'));
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
