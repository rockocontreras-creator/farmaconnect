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

    # Crear administradores por defecto
    import hashlib, random
    from datetime import datetime, timedelta
    APP_SECRET = os.environ.get('APP_SECRET', 'farmaconnect_dev_secret_2024')
    def _hash(p): return hashlib.sha256(f"{APP_SECRET}{p}".encode()).hexdigest()
    cursor = conn.cursor()

    # Admin principal solicitado + admin configurable por variables de entorno
    admins = [
        ("Administrador", "admin@gmail.com", "admin1234"),
        ("Administrador", os.environ.get('ADMIN_EMAIL', 'admin@farmaconnect.cl'),
                          os.environ.get('ADMIN_PASSWORD', 'admin12345')),
    ]
    for nombre, correo, clave in admins:
        try:
            cursor.execute(
                "INSERT INTO usuarios (nombre, correo, contraseña, es_admin) VALUES (?, ?, ?, 1)",
                (nombre, correo, _hash(clave))
            )
            print(f"Admin creado: {correo}")
        except Exception:
            pass  # ya existe

    # ============================================================
    # DATOS DE EJEMPLO PARA LA DEMO (usuarios + historial de junio)
    # ============================================================
    print("Cargando datos de ejemplo para la demostración...")

    # Usuarios de ejemplo (contraseña para todos: demo12345)
    usuarios_demo = [
        ("Juan Contreras", "juan@demo.cl", "demo12345", 0),
        ("Camila Beltrán", "camila@demo.cl", "demo12345", 0),
        ("María González", "maria@demo.cl", "demo12345", 0),
    ]
    for nombre, correo, clave, admin in usuarios_demo:
        try:
            cursor.execute(
                "INSERT INTO usuarios (nombre, correo, contraseña, es_admin) VALUES (?, ?, ?, ?)",
                (nombre, correo, _hash(clave), admin)
            )
        except Exception:
            pass

    # Medicamentos de ejemplo (ampliados)
    medicamentos_demo = [
        "paracetamol", "ibuprofeno", "amoxicilina", "loratadina", "omeprazol",
        "aspirina", "naproxeno", "clonazepam", "metformina", "losartan",
        "cetirizina", "diclofenaco",
    ]
    for med in medicamentos_demo:
        try:
            cursor.execute("INSERT INTO medicamentos (nombre_buscado) VALUES (?)", (med,))
        except Exception:
            pass

    # Precio base por farmacia para cada medicamento (id_farmacia: precio inicial)
    # y el nombre del producto que muestra cada farmacia.
    # Farmacias: 1=Ahumada, 2=Dr. Simi, 3=Salcobrand, 4=Cruz Verde
    base_precios = {
        "paracetamol":  {1: 731,  2: 480,  3: 999,  4: 1290, "nom": "Paracetamol 500 mg"},
        "ibuprofeno":   {1: 1190, 2: 890,  3: 1490, 4: 1390, "nom": "Ibuprofeno 400 mg"},
        "amoxicilina":  {1: 1195, 2: 2200, 3: 3199, 4: 3051, "nom": "Amoxicilina 500 mg"},
        "loratadina":   {1: 990,  2: 750,  3: 1290, 4: 1100, "nom": "Loratadina 10 mg"},
        "omeprazol":    {1: 2490, 2: 1890, 3: 2990, 4: 2690, "nom": "Omeprazol 20 mg"},
        "aspirina":     {1: 1290, 2: 990,  3: 1590, 4: 1450, "nom": "Aspirina 500 mg"},
        "naproxeno":    {1: 2190, 2: 1690, 3: 2490, 4: 2290, "nom": "Naproxeno 550 mg"},
        "clonazepam":   {1: 3490, 2: 2890, 3: 3990, 4: 3690, "nom": "Clonazepam 2 mg"},
        "metformina":   {1: 1890, 2: 1490, 3: 2190, 4: 1990, "nom": "Metformina 850 mg"},
        "losartan":     {1: 2290, 2: 1790, 3: 2690, 4: 2490, "nom": "Losartán 50 mg"},
        "cetirizina":   {1: 1390, 2: 990,  3: 1690, 4: 1490, "nom": "Cetirizina 10 mg"},
        "diclofenaco":  {1: 1590, 2: 1190, 3: 1890, 4: 1690, "nom": "Diclofenaco 50 mg"},
    }

    # Generar historial de precios CADA 2 DÍAS durante junio (1 al 29),
    # con variación realista (los precios suben y bajan ±12%).
    random.seed(42)  # reproducible
    fechas_junio = [datetime(2026, 6, dia, 12, 0, 0) for dia in range(1, 30, 2)]  # 1,3,5,...,29

    total_registros = 0
    for med, datos in base_precios.items():
        fila = cursor.execute(
            "SELECT id_medicamento FROM medicamentos WHERE nombre_buscado = ?", (med,)
        ).fetchone()
        if not fila:
            continue
        id_med = fila[0]
        nombre_prod = datos["nom"]

        # precio actual por farmacia (irá variando en el tiempo)
        actuales = {f: datos[f] for f in (1, 2, 3, 4)}

        for fecha in fechas_junio:
            for id_farm in (1, 2, 3, 4):
                base = datos[id_farm]
                # variación suave alrededor del precio base (±12%)
                factor = 1 + random.uniform(-0.12, 0.12)
                precio = int(round(base * factor / 10) * 10)  # redondear a decenas
                try:
                    cursor.execute(
                        """INSERT INTO historial
                           (id_farmacia, id_medicamento, id_usuario, precio, nombre_especifico, fecha_registro)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (id_farm, id_med, 1, precio, nombre_prod, fecha.strftime("%Y-%m-%d %H:%M:%S"))
                    )
                    total_registros += 1
                except Exception:
                    pass

    print(f"Datos de ejemplo cargados: {total_registros} registros de historial en junio.")

    # ============================================================
    # REPORTES DE LA COMUNIDAD (para niveles de colaborador y panel admin)
    # ============================================================
    # Asegurar que la tabla tenga las columnas estado y motivo_rechazo
    for col, ddl in [("estado", "ALTER TABLE precios_comunidad ADD COLUMN estado TEXT DEFAULT 'pendiente'"),
                     ("motivo_rechazo", "ALTER TABLE precios_comunidad ADD COLUMN motivo_rechazo TEXT")]:
        try:
            cursor.execute(ddl)
        except Exception:
            pass

    # Obtener ids de los usuarios para asignarles reportes
    def _uid(correo):
        r = cursor.execute("SELECT id_usuario FROM usuarios WHERE correo=?", (correo,)).fetchone()
        return r[0] if r else None

    id_juan = _uid("juan@demo.cl")
    id_camila = _uid("camila@demo.cl")
    id_maria = _uid("maria@demo.cl")
    id_admin = _uid("admin@gmail.com")

    farmacias_nom = ["Ahumada", "Dr. Simi", "Salcobrand", "Cruz Verde"]
    comunas = ["Santiago", "Providencia", "Maipú", "La Florida", "Ñuñoa", "Puente Alto"]

    # (id_usuario, nombre, medicamento, farmacia, precio, comuna, estado)
    # Se le dan MUCHOS reportes aprobados a cada usuario para que suban de nivel:
    #   Novato 0-2 / Bronce 3-9 / Plata 10-19 / Oro 20+
    reportes = []

    # Juan -> nivel ORO (20 reportes = mínimo para Oro)
    for i in range(20):
        reportes.append((id_juan, "Juan Contreras",
                         medicamentos_demo[i % len(medicamentos_demo)],
                         farmacias_nom[i % 4],
                         500 + (i * 73) % 3000,
                         comunas[i % len(comunas)], "aprobado", None))

    # Camila -> nivel PLATA (10 reportes = mínimo para Plata)
    for i in range(10):
        reportes.append((id_camila, "Camila Beltrán",
                         medicamentos_demo[(i + 2) % len(medicamentos_demo)],
                         farmacias_nom[(i + 1) % 4],
                         600 + (i * 91) % 2800,
                         comunas[(i + 2) % len(comunas)], "aprobado", None))

    # María -> nivel BRONCE (3 reportes = mínimo para Bronce)
    for i in range(3):
        reportes.append((id_maria, "María González",
                         medicamentos_demo[(i + 4) % len(medicamentos_demo)],
                         farmacias_nom[(i + 2) % 4],
                         700 + (i * 110) % 2500,
                         comunas[(i + 1) % len(comunas)], "aprobado", None))

    # Admin -> nivel ORO (20 reportes)
    for i in range(20):
        reportes.append((id_admin, "Administrador",
                         medicamentos_demo[(i + 1) % len(medicamentos_demo)],
                         farmacias_nom[(i + 3) % 4],
                         550 + (i * 67) % 3200,
                         comunas[(i + 3) % len(comunas)], "aprobado", None))

    # Reportes PENDIENTES (para que el admin los modere desde el panel)
    pendientes = [
        (id_juan,   "Juan Contreras", "paracetamol", "Cruz Verde", 690,  "Santiago",    "pendiente", None),
        (id_camila, "Camila Beltrán", "ibuprofeno",  "Ahumada",    1150, "Providencia", "pendiente", None),
        (id_maria,  "María González", "omeprazol",   "Salcobrand", 2390, "Maipú",       "pendiente", None),
        (id_juan,   "Juan Contreras", "loratadina",  "Dr. Simi",   820,  "Ñuñoa",       "pendiente", None),
        (id_camila, "Camila Beltrán", "amoxicilina", "Cruz Verde", 2990, "La Florida",  "pendiente", None),
    ]
    reportes.extend(pendientes)

    # Un par RECHAZADOS (para que el panel muestre los 3 estados)
    reportes.append((id_maria, "María González", "aspirina", "Ahumada", 99,
                     "Santiago", "rechazado", "Precio fuera de rango, posible error de tipeo"))
    reportes.append((id_juan, "Juan Contreras", "metformina", "Salcobrand", 50,
                     "Maipú", "rechazado", "Precio no verosímil"))

    insertados = 0
    for r in reportes:
        if r[0] is None:
            continue
        try:
            cursor.execute(
                """INSERT INTO precios_comunidad
                   (id_usuario, nombre_usuario, medicamento, farmacia, precio, comuna, estado, motivo_rechazo, votos)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], (insertados * 3) % 15)
            )
            insertados += 1
        except Exception as e:
            print("Error insertando reporte:", e)

    print(f"Reportes de comunidad cargados: {insertados} (aprobados, pendientes y rechazados).")

    conn.commit()

if __name__ == '__main__':
    inicializar_nuevo_esquema()
