const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
require('dotenv').config();
const path = require('path');

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'form.html'));
});

// Guardar pedido
app.post('/pedido', async (req, res) => {
  const { nombre, cedula, producto } = req.body;

  try {
    const precios = {
      'Almuerzo especial empleado': 14000,
      'Bandeja especial empleado': 13000,
      'Almuerzo empleado': 12000,
      'Bandeja empleado': 11500,
      'Desayuno empleado': 6500,
      'Cena empleado': 12500
    };

    const precio = precios[producto] || 0;
    const fecha = new Date();

    await pool.query(
      'INSERT INTO pedidos (fecha, nombre, cedula, producto, precio, entregado) VALUES ($1, $2, $3, $4, $5, $6)',
      [fecha, nombre.trim(), cedula.trim(), producto.trim(), precio, false]
    );

    res.redirect(`/entregas.html`);

  } catch (error) {
    console.error('❌ Error al guardar pedido:', error);
    res.status(500).send('Error al guardar el pedido');
  }
});

// Consultar pedido por cédula
app.get('/api/pedido/:cedula', async (req, res) => {
  const { cedula } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM pedidos WHERE cedula = $1 ORDER BY fecha DESC LIMIT 1',
      [cedula]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró el pedido' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error al consultar el pedido:', err);
    res.status(500).json({ error: 'Error al consultar el pedido' });
  }
});

// Marcar como entregado
app.get('/api/pedido/:cedula/entregar', async (req, res) => {
  const { cedula } = req.params;
  try {
    const result = await pool.query(
      'UPDATE pedidos SET entregado = true WHERE cedula = $1 AND entregado = false RETURNING *',
      [cedula]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('Pedido no encontrado o ya entregado');
    }

    res.send('✅ Pedido marcado como entregado');
  } catch (err) {
    console.error('❌ Error al marcar como entregado:', err);
    res.status(500).send('Error al actualizar el pedido');
  }
});

// Listar todos los pedidos
app.get('/api/pedidos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pedidos ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al obtener pedidos:', err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// Exportar a Excel con filtros
app.get('/api/pedidos/exportar', async (req, res) => {
  try {
    const { cedula, entregado, desde, hasta } = req.query;

    let baseQuery = 'SELECT * FROM pedidos WHERE 1=1';
    const params = [];

    if (cedula) {
      params.push(`%${cedula}%`);
      baseQuery += ` AND cedula ILIKE $${params.length}`;
    }

    if (entregado === 'true' || entregado === 'false') {
      params.push(entregado === 'true');
      baseQuery += ` AND entregado = $${params.length}`;
    }

    if (desde) {
      params.push(new Date(desde));
      baseQuery += ` AND fecha >= $${params.length}`;
    }

    if (hasta) {
      const hastaFecha = new Date(hasta);
      hastaFecha.setHours(23, 59, 59, 999);
      params.push(hastaFecha);
      baseQuery += ` AND fecha <= $${params.length}`;
    }

    baseQuery += ' ORDER BY fecha DESC';

    const result = await pool.query(baseQuery, params);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedidos');

    worksheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Cédula', key: 'cedula', width: 20 },
      { header: 'Producto', key: 'producto', width: 25 },
      { header: 'Precio', key: 'precio', width: 15 },
      { header: 'Entregado', key: 'entregado', width: 15 }
    ];

    result.rows.forEach(p => {
      worksheet.addRow({
        fecha: new Date(p.fecha).toLocaleString(),
        nombre: p.nombre,
        cedula: p.cedula,
        producto: p.producto,
        precio: p.precio,
        entregado: p.entregado ? 'Sí' : 'No'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=pedidos_filtrados.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ Error al exportar pedidos:', err);
    res.status(500).send('Error al exportar pedidos');
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
