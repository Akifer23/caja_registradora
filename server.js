const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const moment = require('moment-timezone');
const app = express();

app.use(cors()); // Habilitar CORS para todas las solicitudes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'caja_registradora'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    }
    console.log('Conectado a la base de datos MySQL');
});

// Variable para mantener el estado del corte
let corteRealizado = false;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para insertar una nueva venta
app.post('/api/ventas', (req, res) => {
    const { id_vendedor, monto } = req.body;
    let fecha = moment().tz('America/Mexico_City'); // Ajusta la zona horaria según tu ubicación

    // Si el corte ha sido realizado, la fecha debe ser del día siguiente
    if (corteRealizado) {
        fecha.add(1, 'day');
    }

    // Formatear fecha para MySQL
    const fechaFormatted = fecha.format('YYYY-MM-DD HH:mm:ss');

    const sql = 'INSERT INTO ventas (id_vendedor, monto, fecha) VALUES (?, ?, ?)';
    db.query(sql, [id_vendedor, monto, fechaFormatted], (err, result) => {
        if (err) {
            console.error('Error inserting sale:', err);
            return res.status(500).send('Error al registrar la venta');
        }
        res.send('Venta registrada');
    });
});

// Ruta para obtener el corte de ventas del día
app.get('/api/corte', (req, res) => {
    const fecha = req.query.fecha;
    if (!fecha) {
        return res.status(400).send('Fecha es requerida');
    }

    const sqlTotal = 'SELECT SUM(monto) AS total FROM ventas WHERE DATE(fecha) = ?';
    const sqlVendedores = `
        SELECT v.vendedor AS nombre, SUM(ve.monto) AS total
        FROM ventas ve
        JOIN vendedores v ON ve.id_vendedor = v.id_vendedor
        WHERE DATE(ve.fecha) = ?
        GROUP BY ve.id_vendedor`;

    db.query(sqlTotal, [fecha], (err, resultTotal) => {
        if (err) {
            console.error('Error fetching total sales:', err);
            return res.status(500).send('Error al obtener el total de ventas');
        }

        db.query(sqlVendedores, [fecha], (err, resultVendedores) => {
            if (err) {
                console.error('Error fetching sales by vendor:', err);
                return res.status(500).send('Error al obtener las ventas por vendedor');
            }

            res.json({
                total: resultTotal[0]?.total || 0,
                ventasPorVendedor: resultVendedores || []
            });
        });
    });
});

// Ruta para realizar el corte
app.post('/api/realizarCorte', (req, res) => {
    corteRealizado = true;
    res.json({ corteRealizado });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});