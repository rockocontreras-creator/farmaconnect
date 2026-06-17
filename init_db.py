import sqlite3
import os

DB_DIR = os.environ.get('DB_DIR', '.')
DB_PATH = os.path.join(DB_DIR, 'farmacia.db')

def inicializar_nuevo_esquema():
    os.makedirs(DB_DIR, exist_ok=True)

    # Si la base de datos ya existe y tiene usuarios, NO la recrear
    # (esto preserva los datos en el disco persistente de Render).
    if os.path.exists(DB_PATH):
        try:
            chk = sqlite3.connect(DB_PATH)
            existe = chk.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
            ).fetchone()
            chk.close()
            if existe:
                print("La base de datos ya existe. Se conservan los datos.")
                return
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Eliminando tablas antiguas para evitar colisiones...")
    cursor.execute("DROP TABLE IF EXISTS historial")
    cursor.execute("DROP TABLE IF EXISTS farmacias")
    cursor.execute("DROP TABLE IF EXISTS medicamentos")
    cursor.execute("DROP TABLE IF EXISTS usuarios")

    print("Creando nuevas tablas maestras unificadas...")
    # 1. Tabla farmacias
    cursor.execute('''CREATE TABLE farmacias (
                        id_farmacias INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre_farmacia TEXT NOT NULL UNIQUE,
                        color_distintivo TEXT NOT NULL
                    )''')

    # 2. Tabla medicamentos
    cursor.execute('''CREATE TABLE medicamentos (
                        id_medicamento INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre_buscado TEXT NOT NULL UNIQUE,
                        requiere_receta INTEGER DEFAULT 0
                    )''')

    # 3. Tabla usuarios
    cursor.execute('''CREATE TABLE usuarios (
                        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT NOT NULL,
                        correo TEXT NOT NULL UNIQUE,
                        contraseña TEXT NOT NULL,
                        es_admin INTEGER DEFAULT 0
                    )''')

    print("Creando tabla transaccional central con llaves foráneas...")
    # 4. Tabla historial central
    cursor.execute('''CREATE TABLE historial (
                        id_historial INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_farmacia INTEGER NOT NULL,
                        id_medicamento INTEGER NOT NULL,
                        id_usuario INTEGER,
                        precio INTEGER NOT NULL,
                        nombre_especifico TEXT NOT NULL,
                        link_producto TEXT,
                        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (id_farmacia) REFERENCES farmacias (id_farmacias) ON DELETE CASCADE,
                        FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento) ON DELETE CASCADE,
                        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
                    )''')

    print("Poblando datos constantes de las cadenas farmacéuticas...")
    farmacias_data = [
        (1, 'Ahumada', '#003399'),
        (2, 'Dr. Simi', '#ce000c'),
        (3, 'Salcobrand', '#ffd400'),
        (4, 'Cruz Verde', '#009639')
    ]
    cursor.executemany("INSERT INTO farmacias (id_farmacias, nombre_farmacia, color_distintivo) VALUES (?,?,?)", farmacias_data)

    print("Creando tablas de chat y alertas...")
    cursor.execute('''CREATE TABLE chat_historial (
                        id_chat INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_usuario INTEGER NOT NULL,
                        rol TEXT NOT NULL,
                        mensaje TEXT NOT NULL,
                        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE)''')

    cursor.execute('''CREATE TABLE alertas_precio (
                        id_alerta INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_usuario INTEGER NOT NULL,
                        medicamento TEXT NOT NULL,
                        umbral_precio INTEGER NOT NULL,
                        activa INTEGER DEFAULT 1,
                        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE)''')

    cursor.execute('''CREATE TABLE precios_comunidad (
                        id_reporte INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_usuario INTEGER NOT NULL,
                        nombre_usuario TEXT,
                        medicamento TEXT NOT NULL,
                        farmacia TEXT NOT NULL,
                        precio INTEGER NOT NULL,
                        comuna TEXT,
                        votos INTEGER DEFAULT 0,
                        fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE)''')

    cursor.execute('''CREATE TABLE ahorros (
                        id_ahorro INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_usuario INTEGER NOT NULL,
                        medicamento TEXT NOT NULL,
                        precio_caro INTEGER NOT NULL,
                        precio_barato INTEGER NOT NULL,
                        ahorro INTEGER NOT NULL,
                        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE)''')

    # Crear un administrador por defecto si no existe ninguno
    # (útil en producción, donde la BD puede reiniciarse)
    import hashlib, os
    APP_SECRET = os.environ.get('APP_SECRET', 'farmaconnect_dev_secret_2024')
    def _hash(p): return hashlib.sha256(f"{APP_SECRET}{p}".encode()).hexdigest()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE es_admin = 1")
    if cursor.fetchone()[0] == 0:
        admin_correo = os.environ.get('ADMIN_EMAIL', 'admin@farmaconnect.cl')
        admin_pass = os.environ.get('ADMIN_PASSWORD', 'admin12345')
        try:
            cursor.execute(
                "INSERT INTO usuarios (nombre, correo, contraseña, es_admin) VALUES (?, ?, ?, 1)",
                ("Administrador", admin_correo, _hash(admin_pass))
            )
            print(f"Admin creado: {admin_correo}")
        except Exception as e:
            print(f"Admin ya existía o error: {e}")

    conn.commit()

if __name__ == '__main__':
    inicializar_nuevo_esquema()
