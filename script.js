lucide.createIcons();

// =========================================================
// ESTADO GLOBAL
// =========================================================
let ultimosResultados = "";
let base64File = null;
let miGrafico = null;

// =========================================================
// COLAPSAR / MOSTRAR SIDEBAR (botón hamburguesa)
// =========================================================
function toggleSidebar() {
    const layout = document.getElementById('app-main');
    if (!layout) return;
    // En móvil el sidebar se desliza desde la izquierda; en escritorio se colapsa
    if (window.innerWidth <= 768) {
        layout.classList.toggle('sidebar-open');
    } else {
        layout.classList.toggle('sidebar-collapsed');
    }
}

// Cerrar el sidebar al tocar fuera de él (solo en móvil)
document.addEventListener('click', function(e) {
    if (window.innerWidth > 768) return;
    const layout = document.getElementById('app-main');
    if (!layout || !layout.classList.contains('sidebar-open')) return;
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.menu-toggle-btn');
    if (sidebar && !sidebar.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
        layout.classList.remove('sidebar-open');
    }
});
// API apunta al mismo servidor que sirve la página.
// En local (abriendo con archivo) usa 127.0.0.1:8000; en producción usa el mismo origen.
const API = (location.protocol === 'file:' || location.hostname === '')
    ? 'http://127.0.0.1:8000'
    : '';

// Token en localStorage — persiste entre recargas
function getToken() { return localStorage.getItem('fc_token'); }
function setToken(t) { localStorage.setItem('fc_token', t); }
function clearToken() { localStorage.removeItem('fc_token'); localStorage.removeItem('fc_usuario'); }
function getUsuario() {
    try { return JSON.parse(localStorage.getItem('fc_usuario')); } catch { return null; }
}
function setUsuario(u) { localStorage.setItem('fc_usuario', JSON.stringify(u)); }

// Headers con token cuando está disponible
function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
}

// =========================================================
// MODO OSCURO
// =========================================================
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    lucide.createIcons();
    if (miGrafico) cargarHistorialFiltrado();
});
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

// =========================================================
// INIT — restaurar sesión desde localStorage sin llamar al servidor
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    const usuario = getUsuario();
    if (token && usuario) {
        // Ya tenemos token guardado → entrar directo sin mostrar overlay
        mostrarApp(usuario);
    } else {
        // Sin sesión → mostrar overlay
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('app-main').style.display = 'none';
    }
    lucide.createIcons();
});

// =========================================================
// AUTENTICACIÓN
// =========================================================
function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-registro').classList.toggle('active', tab === 'registro');
    document.getElementById('form-login').classList.toggle('active-form', tab === 'login');
    document.getElementById('form-registro').classList.toggle('active-form', tab === 'registro');
    ocultarAuthAlert();
}

function mostrarAuthAlert(mensaje, tipo = 'error') {
    const el = document.getElementById('auth-alert');
    el.textContent = mensaje;
    el.className = `auth-alert ${tipo}`;
    el.style.display = 'block';
}

function ocultarAuthAlert() {
    document.getElementById('auth-alert').style.display = 'none';
}

function setBtnLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<div class="auth-spinner"></div> Procesando...`;
    } else {
        btn.disabled = false;
        if (btnId === 'btn-login') {
            btn.innerHTML = `<span>Entrar</span><i data-lucide="arrow-right"></i>`;
        } else {
            btn.innerHTML = `<span>Crear cuenta</span><i data-lucide="user-plus"></i>`;
        }
        lucide.createIcons();
    }
}

async function doLogin() {
    const correo   = document.getElementById('login-correo').value.trim();
    const password = document.getElementById('login-password').value;
    if (!correo || !password) { mostrarAuthAlert('Por favor completa todos los campos.'); return; }

    setBtnLoading('btn-login', true);
    ocultarAuthAlert();
    try {
        const r = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });
        const data = await r.json();
        if (!r.ok) { mostrarAuthAlert(data.error || 'Error al iniciar sesión.'); return; }

        setToken(data.token);
        setUsuario(data.usuario);
        mostrarApp(data.usuario);
    } catch {
        mostrarAuthAlert('No se pudo conectar con el servidor Flask en el puerto 8000.');
    } finally {
        setBtnLoading('btn-login', false);
    }
}

async function doRegistro() {
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const correo   = document.getElementById('reg-correo').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!nombre || !correo || !password) { mostrarAuthAlert('Por favor completa todos los campos.'); return; }

    setBtnLoading('btn-registro', true);
    ocultarAuthAlert();
    try {
        const r = await fetch(`${API}/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, password })
        });
        const data = await r.json();
        if (!r.ok) { mostrarAuthAlert(data.error || 'Error al registrarse.'); return; }

        setToken(data.token);
        setUsuario(data.usuario);
        mostrarApp(data.usuario);
    } catch {
        mostrarAuthAlert('No se pudo conectar con el servidor Flask en el puerto 8000.');
    } finally {
        setBtnLoading('btn-registro', false);
    }
}

async function doLogout() {
    try {
        await fetch(`${API}/logout`, { method: 'POST', headers: authHeaders() });
    } catch (_) {}
    clearToken();

    // Limpiar el chat para que el próximo usuario no vea la conversación anterior
    reiniciarChatVisual();

    // Ocultar app, mostrar overlay
    document.getElementById('app-main').style.display = 'none';
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('fade-out');
    overlay.style.display = 'flex';

    // Limpiar campos
    ['login-correo','login-password','reg-nombre','reg-correo','reg-password']
        .forEach(id => { document.getElementById(id).value = ''; });
    ocultarAuthAlert();
    switchAuthTab('login');
    lucide.createIcons();
}

function mostrarApp(usuario) {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
    document.getElementById('app-main').style.display = 'flex';

    const iniciales = usuario.nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar-initials').textContent = iniciales;
    document.getElementById('sidebar-user-name').textContent = usuario.nombre;
    const emailEl = document.getElementById('sidebar-user-email');
    if (emailEl) emailEl.textContent = usuario.correo;

    // Mostrar el botón de administración solo si el usuario es admin
    const navAdmin = document.getElementById('nav-admin-btn');
    if (navAdmin) navAdmin.style.display = usuario.es_admin ? 'flex' : 'none';

    // Cargar historial de chat persistente
    cargarChatHistorial();

    // Verificar alertas de precio
    verificarAlertas();

    // Actualizar índice de ahorro en sidebar
    actualizarAhorroSidebar();

    lucide.createIcons();
}

function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    lucide.createIcons();
}

// =========================================================
// NAVEGACIÓN
// =========================================================
function showSection(id, btn) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id + '-section').classList.add('active-section');
    if (btn) btn.classList.add('active');
}

function irAlInicio() {
    const homeBtn = document.querySelector('.nav-btn');
    showSection('home', homeBtn);
    cargarMedicamentosPopulares();
}

function irASeccion(id) {
    const btns = document.querySelectorAll('.nav-btn');
    let targetBtn = null;
    btns.forEach(b => {
        const sectionMap = {
            'home': 'Inicio', 'chat': 'Mathew', 'search': 'Comparador',
            'identificador': 'Identificador', 'optimizador': 'Optimizador',
            'history': 'Historial', 'map': 'Mapa'
        };
        if (b.textContent.trim().includes(sectionMap[id] || '')) targetBtn = b;
    });
    showSection(id, targetBtn);
}

// =========================================================
// PÁGINA DE INICIO — CARRUSEL DE MEDICAMENTOS POPULARES
// =========================================================
let carouselMeds = [];
let carouselPage = 0;
let carouselTimer = null;

async function cargarMedicamentosPopulares() {
    const carousel = document.getElementById('home-carousel');
    const emptyEl = document.getElementById('carousel-empty');

    // Skeleton mientras carga
    if (carousel && carouselMeds.length === 0) {
        carousel.innerHTML = `
            <div class="carousel-card carousel-card-lg sk-card"><div class="sk sk-bar" style="width:120px;height:30px;"></div><div class="sk sk-bar" style="width:160px;height:14px;"></div><div class="sk sk-bar" style="width:100px;height:12px;"></div></div>
            <div class="carousel-card carousel-card-lg sk-card"><div class="sk sk-bar" style="width:110px;height:30px;"></div><div class="sk sk-bar" style="width:140px;height:14px;"></div><div class="sk sk-bar" style="width:90px;height:12px;"></div></div>
            <div class="carousel-card carousel-card-lg sk-card"><div class="sk sk-bar" style="width:130px;height:30px;"></div><div class="sk sk-bar" style="width:170px;height:14px;"></div><div class="sk sk-bar" style="width:110px;height:12px;"></div></div>`;
    }

    try {
        const r = await fetch(`${API}/medicamentos_populares`);
        const meds = await r.json();
        if (!meds || meds.length === 0) {
            // Reemplazar skeleton con el estado vacío
            carousel.innerHTML = `<div class="home-carousel-empty" style="display:flex;grid-column:1/-1;">
                <i data-lucide="search" style="width:32px;height:32px;opacity:0.3;"></i>
                <p>Aún no hay medicamentos registrados.</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        carouselMeds = meds;
        carouselPage = 0;
        renderCarouselPage();

        // Auto-rotación cada 3 segundos
        if (carouselTimer) clearInterval(carouselTimer);
        if (meds.length > 3) {
            carouselTimer = setInterval(() => {
                carouselPage = (carouselPage + 1) % Math.ceil(carouselMeds.length / 3);
                renderCarouselPage();
            }, 3000);
        }
    } catch (e) {
        console.error("Error cargando populares:", e);
    }
}

function renderCarouselPage() {
    const carousel = document.getElementById('home-carousel');
    if (!carousel || carouselMeds.length === 0) return;

    const start = carouselPage * 3;
    const visibles = carouselMeds.slice(start, start + 3);
    // Si la última página tiene menos de 3, completar desde el inicio
    while (visibles.length < 3 && carouselMeds.length >= 3) {
        visibles.push(carouselMeds[visibles.length % carouselMeds.length]);
    }

    const totalPages = Math.ceil(carouselMeds.length / 3);

    let html = '';
    visibles.forEach(m => {
        const precioFormateado = m.precio_min ? `$${m.precio_min.toLocaleString('es-CL')}` : '—';
        const spark = generarSparkline(m.tendencia, m.color);
        html += `<div class="carousel-card carousel-card-lg" onclick="irASeccion('search'); setTimeout(()=>{ document.getElementById('manual-search').value='${m.nombre}'; }, 100);">
            <div class="carousel-card-badge-top">${m.busquedas} búsqueda${m.busquedas !== 1 ? 's' : ''}</div>
            <div class="carousel-card-price">${precioFormateado} <span>CLP</span></div>
            <div class="carousel-card-name">${m.nombre.toUpperCase()}</div>
            <div class="carousel-card-farm" style="color:${m.color || 'var(--text-muted)'};">
                <span class="carousel-dot" style="background:${m.color};"></span>
                ${m.farmacia || 'Sin datos'}
            </div>
            ${spark}
        </div>`;
    });

    // Indicadores de página (dots)
    if (totalPages > 1) {
        html += `<div class="carousel-dots-row">`;
        for (let i = 0; i < totalPages; i++) {
            html += `<button class="carousel-page-dot${i === carouselPage ? ' active' : ''}" onclick="irAPaginaCarrusel(${i})"></button>`;
        }
        html += `</div>`;
    }

    carousel.innerHTML = html;
}

function generarSparkline(datos, colorFarmacia) {
    // Necesita al menos 2 puntos para dibujar una línea
    if (!datos || datos.length < 2) {
        return `<div class="sparkline-empty">Sin tendencia suficiente</div>`;
    }

    const W = 150, H = 36, pad = 3;
    const min = Math.min(...datos);
    const max = Math.max(...datos);
    const rango = max - min || 1;

    // Calcular puntos (x, y) normalizados al tamaño del SVG
    const puntos = datos.map((val, i) => {
        const x = pad + (i / (datos.length - 1)) * (W - pad * 2);
        const y = H - pad - ((val - min) / rango) * (H - pad * 2);
        return [x, y];
    });

    // Determinar tendencia: comparar primer vs último precio
    const subio = datos[datos.length - 1] > datos[0];
    const bajo = datos[datos.length - 1] < datos[0];
    // Para precios: que BAJE es bueno (verde), que SUBA es malo (rojo)
    const colorLinea = bajo ? '#10b981' : subio ? '#ef4444' : '#94a3b8';

    // Construir el path de la línea
    const pathLinea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

    // Path del área de relleno (cierra hacia abajo)
    const pathArea = `${pathLinea} L ${puntos[puntos.length - 1][0].toFixed(1)} ${H} L ${puntos[0][0].toFixed(1)} ${H} Z`;

    // ID único para el gradiente
    const gradId = 'spark-' + Math.random().toString(36).substr(2, 6);

    // Cálculo del cambio porcentual
    const cambioPct = (((datos[datos.length - 1] - datos[0]) / datos[0]) * 100).toFixed(1);
    const flechaIcon = bajo ? '↓' : subio ? '↑' : '→';
    const cambioTexto = cambioPct > 0 ? `+${cambioPct}%` : `${cambioPct}%`;

    return `<div class="sparkline-wrap">
        <svg class="sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${colorLinea}" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="${colorLinea}" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${pathArea}" fill="url(#${gradId})"/>
            <path d="${pathLinea}" fill="none" stroke="${colorLinea}" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${puntos[puntos.length - 1][0].toFixed(1)}" cy="${puntos[puntos.length - 1][1].toFixed(1)}"
                    r="2.5" fill="${colorLinea}"/>
        </svg>
        <span class="sparkline-trend" style="color:${colorLinea};">${flechaIcon} ${cambioTexto}</span>
    </div>`;
}

function irAPaginaCarrusel(page) {
    carouselPage = page;
    renderCarouselPage();
    // Reiniciar el timer al interactuar
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
        carouselPage = (carouselPage + 1) % Math.ceil(carouselMeds.length / 3);
        renderCarouselPage();
    }, 3000);
}


// Cargar populares al inicio
document.addEventListener('DOMContentLoaded', () => { setTimeout(cargarMedicamentosPopulares, 500); });

// =========================================================
// ARCHIVOS ADJUNTOS
// =========================================================
function previewFile() {
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('file-preview-container');
    const previewName = document.getElementById('file-preview-name');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        previewName.textContent = file.name;
        previewContainer.style.display = 'flex';
        const reader = new FileReader();
        reader.onload = e => { base64File = e.target.result.split(',')[1]; };
        reader.readAsDataURL(file);
    }
}

function clearFile() {
    document.getElementById('file-input').value = "";
    document.getElementById('file-preview-container').style.display = 'none';
    base64File = null;
}

// =========================================================
// HISTORIAL DE CHAT PERSISTENTE
// =========================================================
// Mensaje de bienvenida por defecto del chat (se usa al cerrar sesión o sin historial)
const CHAT_BIENVENIDA = `
    <div class="chat-msg chat-msg-bot">
        <div class="chat-avatar chat-avatar-bot"><i data-lucide="bot"></i></div>
        <div class="chat-msg-content">
            <span class="chat-sender-name">Mathew</span>
            <div class="chat-bubble chat-bubble-bot">¡Hola! Bienvenido a <strong>FarmaConnect</strong>. ¿En qué malestar o síntoma puedo orientarte hoy? También puedo ayudarte a encontrar farmacias o clínicas cercanas.</div>
        </div>
    </div>`;

function reiniciarChatVisual() {
    const box = document.getElementById('chat-box');
    if (box) {
        box.innerHTML = CHAT_BIENVENIDA;
        lucide.createIcons();
    }
}

async function cargarChatHistorial() {
    if (!getToken()) return;
    // Siempre limpiar el chat antes de cargar el del usuario actual,
    // para no mostrar la conversación de un usuario anterior.
    reiniciarChatVisual();
    try {
        const r = await fetch(`${API}/chat/historial`, { headers: authHeaders() });
        if (!r.ok) return;
        const mensajes = await r.json();
        if (mensajes.length === 0) return;  // se queda el mensaje de bienvenida

        const box = document.getElementById('chat-box');
        box.innerHTML = '';

        mensajes.forEach(m => {
            if (m.rol === 'user') {
                box.innerHTML += renderUserMsg(m.mensaje, m.fecha);
            } else {
                box.innerHTML += renderBotMsg(marked.parse(m.mensaje), m.fecha);
            }
        });

        box.scrollTop = box.scrollHeight;
        lucide.createIcons();
    } catch (e) {
        console.error("Error cargando historial de chat:", e);
    }
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

async function limpiarChatHistorial() {
    if (!confirm('¿Eliminar todo el historial de conversación con Mathew?')) return;
    try {
        if (getToken()) {
            await fetch(`${API}/chat/historial`, { method: 'DELETE', headers: authHeaders() });
        }
    } catch (_) {}
    const box = document.getElementById('chat-box');
    box.innerHTML = renderBotMsg('¡Historial limpiado! ¿En qué puedo ayudarte ahora?');
    lucide.createIcons();
}

// =========================================================
// ENTRADA POR VOZ (Web Speech API)
// =========================================================
let reconocimientoVoz = null;
let vozActiva = false;

function initVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        // Navegador no soporta Web Speech API — ocultar botón de mic
        const micBtn = document.getElementById('btn-mic');
        if (micBtn) micBtn.style.display = 'none';
        return;
    }

    reconocimientoVoz = new SpeechRecognition();
    reconocimientoVoz.lang = 'es-CL';        // español chileno
    reconocimientoVoz.continuous = false;      // se detiene tras una frase
    reconocimientoVoz.interimResults = true;   // muestra texto parcial mientras habla

    reconocimientoVoz.onresult = (event) => {
        let texto = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            texto += event.results[i][0].transcript;
        }
        document.getElementById('chat-input').value = texto;
    };

    reconocimientoVoz.onend = () => {
        vozActiva = false;
        actualizarUIVoz(false);
        // Si hay texto reconocido, enviar automáticamente
        const input = document.getElementById('chat-input');
        if (input.value.trim()) {
            enviarMensaje();
        }
    };

    reconocimientoVoz.onerror = (event) => {
        console.log('Error de reconocimiento de voz:', event.error);
        vozActiva = false;
        actualizarUIVoz(false);
        if (event.error === 'not-allowed') {
            alert('Permiso de micrófono denegado. Habilítalo en la configuración del navegador.');
        }
    };
}

function toggleVoz() {
    if (!reconocimientoVoz) {
        initVoz();
        if (!reconocimientoVoz) {
            alert('Tu navegador no soporta entrada por voz. Usa Chrome para esta función.');
            return;
        }
    }

    if (vozActiva) {
        detenerVoz();
    } else {
        vozActiva = true;
        actualizarUIVoz(true);
        document.getElementById('chat-input').value = '';
        reconocimientoVoz.start();
    }
}

function detenerVoz() {
    if (reconocimientoVoz && vozActiva) {
        reconocimientoVoz.stop();
    }
    vozActiva = false;
    actualizarUIVoz(false);
}

function actualizarUIVoz(activa) {
    const micBtn = document.getElementById('btn-mic');
    const indicator = document.getElementById('voice-indicator');
    const micIcon = document.getElementById('mic-icon');

    if (activa) {
        micBtn.classList.add('mic-active');
        indicator.style.display = 'flex';
        micIcon.setAttribute('data-lucide', 'mic-off');
    } else {
        micBtn.classList.remove('mic-active');
        indicator.style.display = 'none';
        micIcon.setAttribute('data-lucide', 'mic');
    }
    lucide.createIcons();
}

// Inicializar voz al cargar
document.addEventListener('DOMContentLoaded', () => { initVoz(); });

// =========================================================
// GEOLOCALIZACIÓN DEL USUARIO (para contexto de Mathew)
// =========================================================
let userLat = null, userLng = null;

function obtenerUbicacion() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; },
            () => { /* permiso denegado — no pasa nada, Mathew funciona sin ubicación */ },
            { timeout: 5000 }
        );
    }
}
document.addEventListener('DOMContentLoaded', obtenerUbicacion);

// =========================================================
// HELPERS DE RENDERIZADO DE CHAT
// =========================================================
function getTimeStr(fecha) {
    if (fecha) {
        // fecha viene como "2026-06-06 20:51:45"
        const parts = fecha.substring(11, 16);
        if (parts && parts.includes(':')) return parts;
    }
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

function getUserInitials() {
    const el = document.getElementById('user-avatar-initials');
    return el ? el.textContent : '?';
}

function renderUserMsg(text, fecha) {
    return `<div class="chat-msg chat-msg-user">
        <div class="chat-msg-content">
            <div class="chat-bubble chat-bubble-user">${escapeHtml(text)}</div>
            <span class="chat-ts">${getTimeStr(fecha)}</span>
        </div>
        <div class="chat-avatar chat-avatar-user">${getUserInitials()}</div>
    </div>`;
}

function renderBotMsg(htmlContent, fecha) {
    return `<div class="chat-msg chat-msg-bot">
        <div class="chat-avatar chat-avatar-bot"><i data-lucide="bot"></i></div>
        <div class="chat-msg-content">
            <span class="chat-sender-name">Mathew</span>
            <div class="chat-bubble chat-bubble-bot">${htmlContent}</div>
            <span class="chat-ts">${getTimeStr(fecha)}</span>
        </div>
    </div>`;
}

function renderBotLoading() {
    return `<div class="chat-msg chat-msg-bot" id="chat-loading-msg">
        <div class="chat-avatar chat-avatar-bot"><i data-lucide="bot"></i></div>
        <div class="chat-msg-content">
            <span class="chat-sender-name">Mathew</span>
            <div class="chat-bubble chat-bubble-bot chat-typing">
                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
            </div>
        </div>
    </div>`;
}

// =========================================================
// MATHEW IA — sin autenticación requerida
// =========================================================
async function enviarMensaje() {
    const inp = document.getElementById('chat-input');
    const box = document.getElementById('chat-box');
    const prompt = inp.value.trim();
    if (!prompt && !base64File) return;

    const userMsg = prompt || "🖼️ Imagen de Receta Médica enviada";
    box.innerHTML += renderUserMsg(userMsg);
    inp.value = "";
    box.scrollTop = box.scrollHeight;

    inp.disabled = true;
    const sendBtn = document.querySelector('.chat-input-wrapper .btn-premium');
    if (sendBtn) sendBtn.disabled = true;

    const fileToSend = base64File;
    clearFile();

    // Mostrar indicador de escritura
    box.innerHTML += renderBotLoading();
    lucide.createIcons();
    box.scrollTop = box.scrollHeight;

    try {
        const payload = {
            pregunta: prompt,
            idioma: localStorage.getItem('fc_lang') || 'es',
            contexto_precios: ultimosResultados,
            archivo_base64: fileToSend
        };
        // Incluir ubicación si la tenemos
        if (userLat && userLng) {
            payload.latitud = userLat;
            payload.longitud = userLng;
        }

        const r = await fetch(`${API}/consultar_asistente`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        // Quitar indicador de escritura
        const loadEl = document.getElementById('chat-loading-msg');
        if (loadEl) loadEl.remove();
        // Renderizar respuesta con el nuevo formato
        box.innerHTML += renderBotMsg(marked.parse(data.respuesta));
        lucide.createIcons();
        box.scrollTop = box.scrollHeight;
    } catch {
        const loadEl = document.getElementById('chat-loading-msg');
        if (loadEl) loadEl.remove();
        box.innerHTML += renderBotMsg('<span style="color:var(--text-muted);">No se pudo conectar con Mathew.</span>');
        lucide.createIcons();
    } finally {
        inp.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        inp.focus();
    }
}

// =========================================================
// COMPARADOR — requiere login
// =========================================================
let todosResultados = []; // almacenamos TODOS los resultados para filtrar

async function startScraping() {
    const q = document.getElementById('manual-search').value.trim();
    const res = document.getElementById('scraping-results');
    const tools = document.getElementById('comparador-tools');
    const searchBtn = document.querySelector('.search-bar-box button');
    if (!q) return;

    if (!getToken()) {
        res.innerHTML = `<div class="auth-required-notice"><i data-lucide="lock" style="width:20px;height:20px;"></i>
            <span>Para usar el comparador necesitas <button onclick="pedirLogin()" class="link-btn">iniciar sesión</button>.</span></div>`;
        lucide.createIcons();
        return;
    }

    searchBtn.disabled = true;
    tools.style.display = 'none';
    document.getElementById('bioequivalente-result').style.display = 'none';
    res.innerHTML = renderSkeletonTabla();

    try {
        const r = await fetch(`${API}/scraping_manual`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ remedio: q })
        });

        if (r.status === 401) {
            clearToken();
            res.innerHTML = `<div class="auth-required-notice"><i data-lucide="lock" style="width:20px;height:20px;"></i>
                <span>Sesión expirada. <button onclick="pedirLogin()" class="link-btn">Inicia sesión nuevamente</button>.</span></div>`;
            lucide.createIcons();
            return;
        }

        const data = await r.json();
        ultimosResultados = JSON.stringify(data.precios);
        todosResultados = data.precios || [];
        window.farmaciasSinDatos = data.farmacias_sin_datos || [];

        if (todosResultados.length === 0) {
            res.innerHTML = "<p style='color:var(--text-muted);padding:10px;'>No se encontraron resultados para este término en ninguna farmacia. Intenta con otro nombre (ej: 'paracetamol' en vez de una marca específica).</p>";
            return;
        }

        // Mostrar herramientas (filtros + bioequivalente)
        tools.style.display = 'block';
        // Reset filtro activo
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.filter-tab').classList.add('active');

        renderTablaResultados(todosResultados);
        // Cargar precios reportados por la comunidad para este medicamento
        cargarPreciosComunidad(q);
        // Mostrar calculadora de tratamiento
        document.getElementById('calc-tratamiento').style.display = 'block';
        calcularTratamiento();
        // Actualizar el ahorro en el sidebar
        actualizarAhorroSidebar();
    } catch {
        res.innerHTML = "<p style='color:var(--text-muted);'>El servidor Flask en el puerto 8000 no responde.</p>";
    } finally {
        searchBtn.disabled = false;
    }
}

function renderTablaResultados(items) {
    const res = document.getElementById('scraping-results');
    if (!items || items.length === 0) {
        res.innerHTML = "<p style='color:var(--text-muted);padding:10px;'>Sin resultados para este filtro.</p>";
        return;
    }

    // Deduplicar: eliminar resultados con mismo farmacia + mismo nombre
    const seen = new Set();
    const dedupItems = items.filter(p => {
        const key = `${p.farmacia}|${p.nombre}|${p.precio}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    let menorPrecio = Infinity;
    dedupItems.forEach(p => {
        const val = parseInt(String(p.precio).replace(/\D/g, ''), 10);
        if (!isNaN(val) && val < menorPrecio) menorPrecio = val;
    });

    const ordenados = [...dedupItems].sort((a, b) => {
        const va = parseInt(String(a.precio).replace(/\D/g, ''), 10) || Infinity;
        const vb = parseInt(String(b.precio).replace(/\D/g, ''), 10) || Infinity;
        return va - vb;
    });

    // Contador por farmacia
    const conteo = {};
    dedupItems.forEach(p => { conteo[p.farmacia] = (conteo[p.farmacia] || 0) + 1; });
    const farmacias = Object.keys(conteo);
    const resumenHtml = farmacias.map(f => `<span class="results-summary-chip">${f}: ${conteo[f]}</span>`).join('');

    let html = `<div class="results-summary">${resumenHtml} — <strong>${dedupItems.length} resultados</strong></div>
        <div class="results-table-wrapper"><table class="results-table"><thead><tr>
            <th>Farmacia</th><th>Producto encontrado</th><th>Precio</th><th>Estado</th><th style="text-align:right;">Acción</th>
        </tr></thead><tbody>`;

    ordenados.forEach(p => {
        const val = parseInt(String(p.precio).replace(/\D/g, ''), 10);
        const esMasBarato = val === menorPrecio;
        const iniciales = p.farmacia.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        let celdaPrecio = `<span class="precio-actual">$${p.precio}</span><span class="precio-clp">CLP</span>`;
        if (p.oferta && p.precio_original) {
            celdaPrecio += `<br><span class="precio-original">$${p.precio_original}</span>`;
        }

        let badges = '';
        if (esMasBarato) badges += `<span class="badge badge-barato">💰 Más barato</span>`;
        if (p.oferta) badges += `<span class="badge badge-oferta">🏷️ En oferta</span>`;
        if (!badges) badges = `<span class="badge badge-normal">Precio normal</span>`;

        html += `<tr${esMasBarato ? ' class="row-barato"' : ''}>
            <td><div class="farmacia-cell">
                <div class="farmacia-avatar" style="background:${p.color};">${iniciales}</div>
                <span class="farmacia-nombre" style="color:${p.color};">${p.farmacia}</span>
            </div></td>
            <td><span class="producto-nombre">${p.nombre}</span></td>
            <td class="precio-cell">${celdaPrecio}</td>
            <td><div class="badges-cell">${badges}</div></td>
            <td style="text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                    <button class="btn-alert-row" onclick="abrirModalAlerta('${p.nombre.replace(/'/g,"\\'")}', '${p.precio}')" title="Crear alerta de precio">
                        <i data-lucide="bell-plus"></i>
                    </button>
                    <a href="${p.link}" target="_blank" class="btn-ir-web">Ir a la web <span>↗</span></a>
                </div>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;

    // Aviso honesto: farmacias que no devolvieron resultados
    if (window.farmaciasSinDatos && window.farmaciasSinDatos.length > 0) {
        html += `<div class="farmacias-sin-datos">
            <i data-lucide="info" style="width:14px;height:14px;"></i>
            Sin resultados en: ${window.farmaciasSinDatos.join(', ')}. Puede que no vendan este producto o que su sitio no respondiera.
        </div>`;
    }

    res.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function filtrarResultados(filtro, btn) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    let filtrados;
    switch (filtro) {
        case 'ofertas':
            filtrados = todosResultados.filter(p => p.oferta);
            break;
        case 'baratos':
            // Solo el más barato por farmacia
            const vistos = {};
            filtrados = [];
            const sorted = [...todosResultados].sort((a, b) => {
                return (parseInt(String(a.precio).replace(/\D/g,''),10)||Infinity) -
                       (parseInt(String(b.precio).replace(/\D/g,''),10)||Infinity);
            });
            sorted.forEach(p => {
                if (!vistos[p.farmacia]) { vistos[p.farmacia] = true; filtrados.push(p); }
            });
            break;
        default:
            filtrados = todosResultados;
    }
    renderTablaResultados(filtrados);
}

async function buscarBioequivalente() {
    const q = document.getElementById('manual-search').value.trim();
    if (!q) return;
    const resultDiv = document.getElementById('bioequivalente-result');
    const btn = document.getElementById('btn-bioequivalente');
    btn.disabled = true;
    btn.innerHTML = '<div class="auth-spinner"></div> Analizando...';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:8px;">Consultando principio activo...</p>';

    try {
        const r = await fetch(`${API}/bioequivalente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: q })
        });
        const data = await r.json();
        if (data.error) {
            resultDiv.innerHTML = `<p style="color:#ef4444;padding:8px;">${data.error}</p>`;
            return;
        }

        let alts = '';
        if (data.alternativas && data.alternativas.length > 0) {
            alts = data.alternativas.map(a =>
                `<button class="bio-alt-btn" onclick="document.getElementById('manual-search').value='${a}'; startScraping();">${a}</button>`
            ).join('');
        }

        resultDiv.innerHTML = `<div class="bio-result-card">
            <div class="bio-result-header">
                <span class="bio-label">Principio activo:</span>
                <strong>${data.principio_activo || 'Desconocido'}</strong>
                ${data.dosis_comun ? `<span class="bio-dosis">${data.dosis_comun}</span>` : ''}
                ${data.es_generico ? '<span class="badge badge-barato">Ya es genérico</span>' : '<span class="badge badge-oferta">Marca comercial</span>'}
            </div>
            ${data.buscar ? `<button class="btn-premium bio-search-btn" onclick="document.getElementById('manual-search').value='${data.buscar}'; startScraping();">
                <i data-lucide="search"></i> Buscar "${data.buscar}" (genérico)
            </button>` : ''}
            ${alts ? `<div class="bio-alts"><span class="bio-label">Alternativas:</span>${alts}</div>` : ''}
        </div>`;
        lucide.createIcons();
    } catch {
        resultDiv.innerHTML = '<p style="color:#ef4444;padding:8px;">Error al consultar.</p>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="flask-conical"></i> Buscar alternativa genérica';
        lucide.createIcons();
    }
}

// Abre el overlay de login desde dentro de la app
function pedirLogin() {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('fade-out');
    overlay.style.display = 'flex';
    switchAuthTab('login');
}

// =========================================================
// HISTORIAL
// =========================================================
async function abrirHistorial(btn) {
    showSection('history', btn);
    await inicializarSelector();
}

async function inicializarSelector() {
    const selector = document.getElementById('med-selector');
    try {
        const r = await fetch(`${API}/obtener_medicamentos`);
        const medicamentos = await r.json();
        selector.innerHTML = '<option value="">-- Elige un medicamento --</option>';
        if (medicamentos.length === 0) {
            selector.innerHTML = '<option value="">Sin registros en SQLite</option>';
            return;
        }
        medicamentos.forEach(med => {
            const opt = document.createElement('option');
            opt.value = med;
            opt.textContent = med.toUpperCase();
            selector.appendChild(opt);
        });
    } catch (e) {
        console.error("Error cargando selector:", e);
    }
}

async function cargarHistorialFiltrado() {
    const medSeleccionado = document.getElementById('med-selector').value;
    if (!medSeleccionado) return;

    const statsGrid = document.getElementById('hist-stats');
    const dataTable = document.getElementById('hist-data-table');

    try {
        const r = await fetch(`${API}/obtener_historial?medicamento=${encodeURIComponent(medSeleccionado)}`);
        const data = await r.json();
        if (data.length === 0) {
            statsGrid.style.display = 'none';
            dataTable.style.display = 'none';
            return;
        }

        // --- ESTADÍSTICAS ---
        const precios = data.map(row => row[3]).filter(p => p > 0);
        const minPrecio = Math.min(...precios);
        const maxPrecio = Math.max(...precios);
        const avgPrecio = Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
        const minRow = data.find(row => row[3] === minPrecio);
        const maxRow = data.find(row => row[3] === maxPrecio);

        document.getElementById('hist-stat-min').textContent = `$${minPrecio.toLocaleString('es-CL')}`;
        document.getElementById('hist-stat-min-farm').textContent = minRow ? minRow[1] : '—';
        document.getElementById('hist-stat-max').textContent = `$${maxPrecio.toLocaleString('es-CL')}`;
        document.getElementById('hist-stat-max-farm').textContent = maxRow ? maxRow[1] : '—';
        document.getElementById('hist-stat-avg').textContent = `$${avgPrecio.toLocaleString('es-CL')}`;
        document.getElementById('hist-stat-count').textContent = data.length;
        document.getElementById('hist-stat-count-sub').textContent = `en ${[...new Set(data.map(r => r[1]))].length} farmacias`;
        statsGrid.style.display = 'grid';

        // --- GRÁFICO CON GRADIENTES ---
        const etiquetas = [...new Set(data.map(row => {
            const f = row[4];
            return f.substring(5, 10) + ' ' + f.substring(11, 16);
        }))];

        const farmConfig = [
            { nombre: 'Ahumada',    color: '#003399' },
            { nombre: 'Dr. Simi',   color: '#ce000c' },
            { nombre: 'Salcobrand', color: '#ffd400' },
            { nombre: 'Cruz Verde', color: '#009639' }
        ];

        if (miGrafico) miGrafico.destroy();

        const ctx = document.getElementById('historyChart').getContext('2d');
        const dark = document.body.classList.contains('dark-mode');

        const datasets = farmConfig.map(fc => {
            const valores = etiquetas.map(e => {
                const match = data.find(row => row[1] === fc.nombre && (row[4].substring(5, 10) + ' ' + row[4].substring(11, 16)) === e);
                return match ? match[3] : null;
            });

            // Crear gradiente de relleno
            const gradient = ctx.createLinearGradient(0, 0, 0, 350);
            gradient.addColorStop(0, fc.color + '30');
            gradient.addColorStop(1, fc.color + '05');

            return {
                label: fc.nombre,
                data: valores,
                borderColor: fc.color,
                backgroundColor: gradient,
                tension: 0.35,
                spanGaps: true,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: fc.color,
                pointBorderColor: dark ? '#1e293b' : '#ffffff',
                pointBorderWidth: 2,
                borderWidth: 3,
                fill: true
            };
        }).filter(ds => ds.data.some(v => v !== null));

        miGrafico = new Chart(ctx, {
            type: 'line',
            data: { labels: etiquetas, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: dark ? '#f1f5f9' : '#1e293b',
                            font: { family: 'Inter', weight: '600', size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: dark ? '#1e293b' : '#ffffff',
                        titleColor: dark ? '#f1f5f9' : '#1e293b',
                        bodyColor: dark ? '#94a3b8' : '#64748b',
                        borderColor: dark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { family: 'Inter', weight: '700', size: 13 },
                        bodyFont: { family: 'Inter', size: 12 },
                        callbacks: {
                            label: ctx => ctx.dataset.label + ': $' + (ctx.parsed.y ? ctx.parsed.y.toLocaleString('es-CL') : '—') + ' CLP'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: dark ? '#94a3b8' : '#64748b', font: { size: 11 } },
                        grid: { color: dark ? '#334155' + '40' : '#e2e8f0' + '80' }
                    },
                    y: {
                        ticks: {
                            color: dark ? '#94a3b8' : '#64748b',
                            font: { size: 11 },
                            callback: v => '$' + v.toLocaleString('es-CL')
                        },
                        grid: { color: dark ? '#334155' + '40' : '#e2e8f0' + '80' }
                    }
                }
            }
        });

        // --- TABLA DE DATOS ---
        let tableHtml = `<thead><tr><th>Fecha</th><th>Farmacia</th><th>Producto</th><th>Precio</th></tr></thead><tbody>`;
        [...data].reverse().forEach(row => {
            tableHtml += `<tr>
                <td style="white-space:nowrap;">${row[4] ? row[4].substring(0, 16) : '—'}</td>
                <td><strong>${row[1]}</strong></td>
                <td>${row[2]}</td>
                <td style="font-weight:700;color:#10b981;">$${row[3].toLocaleString('es-CL')} CLP</td>
            </tr>`;
        });
        tableHtml += '</tbody>';
        document.getElementById('hist-table-body').innerHTML = tableHtml;
        dataTable.style.display = 'block';

    } catch (e) {
        console.error("Error Chart.js:", e);
    }
}

// =========================================================
// MAPA
// =========================================================
function actualizarMapa(tipo) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => { document.getElementById('map-iframe').src = `https://maps.google.com/maps?q=${tipo}&ll=${p.coords.latitude},${p.coords.longitude}&z=14&output=embed`; },
            ()  => { document.getElementById('map-iframe').src = `https://maps.google.com/maps?q=${tipo}&z=13&output=embed`; }
        );
    }
}

// =========================================================
// IDENTIFICADOR DE PASTILLAS
// =========================================================
let pillImages = []; // array de { base64, dataUrl }

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('pill-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 2);
        files.forEach(f => agregarImagenPastilla(f));
    });
});

function pillFileSelected(e) {
    const files = Array.from(e.target.files).slice(0, 2 - pillImages.length);
    files.forEach(f => agregarImagenPastilla(f));
    e.target.value = ''; // permite reseleccionar el mismo archivo
}

function agregarImagenPastilla(file) {
    if (pillImages.length >= 2) return;
    const reader = new FileReader();
    reader.onload = ev => {
        pillImages.push({
            base64: ev.target.result.split(',')[1],
            dataUrl: ev.target.result
        });
        renderPillPreviews();
    };
    reader.readAsDataURL(file);
}

function renderPillPreviews() {
    const container = document.getElementById('pill-previews');
    const placeholder = document.getElementById('pill-placeholder');

    if (pillImages.length === 0) {
        container.style.display = 'none';
        placeholder.style.display = 'flex';
        document.getElementById('pill-identify-btn').disabled = true;
        document.getElementById('pill-clear-btn').style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    container.style.display = 'flex';
    document.getElementById('pill-identify-btn').disabled = false;
    document.getElementById('pill-clear-btn').style.display = 'inline-flex';

    let html = '';
    pillImages.forEach((img, i) => {
        html += `<div class="pill-preview-slot">
            <img src="${img.dataUrl}" alt="Foto ${i + 1}">
            <button class="pill-preview-remove" onclick="event.stopPropagation(); quitarImagenPastilla(${i})">✕</button>
            <span class="pill-preview-label">${i === 0 ? 'Anverso' : 'Reverso'}</span>
        </div>`;
    });
    if (pillImages.length < 2) {
        html += `<div class="pill-preview-slot pill-add-slot" onclick="event.stopPropagation(); document.getElementById('pill-file-input').click();">
            <i data-lucide="plus" style="width:28px;height:28px;color:var(--text-muted);"></i>
            <span style="font-size:0.8rem;color:var(--text-muted);">Agregar reverso</span>
        </div>`;
    }
    container.innerHTML = html;
    lucide.createIcons();
}

function quitarImagenPastilla(index) {
    pillImages.splice(index, 1);
    renderPillPreviews();
    document.getElementById('pill-result').style.display = 'none';
}

function limpiarIdentificador() {
    pillImages = [];
    document.getElementById('pill-file-input').value = '';
    renderPillPreviews();
    document.getElementById('pill-result').style.display = 'none';
}

async function identificarPastilla() {
    if (pillImages.length === 0) return;
    const btn = document.getElementById('pill-identify-btn');
    const resultDiv = document.getElementById('pill-result');

    btn.disabled = true;
    btn.innerHTML = '<div class="auth-spinner"></div> Analizando imagen...';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="pill-analyzing">
            <div class="pill-scan-animation"></div>
            <p>La IA está analizando ${pillImages.length > 1 ? 'las pastillas' : 'la pastilla'}...</p>
        </div>`;

    try {
        const r = await fetch(`${API}/identificar_pastilla`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagenes_base64: pillImages.map(i => i.base64) })
        });
        const data = await r.json();

        if (data.error) {
            resultDiv.innerHTML = `<div class="pill-error">${data.error}</div>`;
            return;
        }

        const p = data.resultado;
        const confianzaColor = p.confianza === 'alta' ? '#10b981' : p.confianza === 'media' ? '#f59e0b' : '#ef4444';
        const confianzaLabel = p.confianza === 'alta' ? 'Alta confianza' : p.confianza === 'media' ? 'Confianza media' : 'Baja confianza';

        resultDiv.innerHTML = `
            <div class="pill-result-card">
                <div class="pill-result-header">
                    <div>
                        <h3 class="pill-result-name">${p.nombre || 'No identificado'}</h3>
                        <p class="pill-result-activo">${p.principio_activo || ''}</p>
                    </div>
                    <span class="pill-confianza-badge" style="background:${confianzaColor}20;color:${confianzaColor};border:1px solid ${confianzaColor}40;">
                        ${confianzaLabel}
                    </span>
                </div>

                <div class="pill-result-grid">
                    ${p.descripcion ? `<div class="pill-info-block"><span class="pill-info-label">¿Para qué sirve?</span><p>${p.descripcion}</p></div>` : ''}
                    <div class="pill-info-row">
                        ${p.forma ? `<div class="pill-info-chip"><i data-lucide="pill" style="width:14px;height:14px;"></i> ${p.forma}</div>` : ''}
                        ${p.color ? `<div class="pill-info-chip"><i data-lucide="palette" style="width:14px;height:14px;"></i> ${p.color}</div>` : ''}
                        ${p.grabado && p.grabado !== 'N/A' ? `<div class="pill-info-chip"><i data-lucide="type" style="width:14px;height:14px;"></i> ${p.grabado}</div>` : ''}
                        ${p.laboratorio && p.laboratorio !== 'Desconocido' ? `<div class="pill-info-chip"><i data-lucide="building-2" style="width:14px;height:14px;"></i> ${p.laboratorio}</div>` : ''}
                        ${p.categoria ? `<div class="pill-info-chip"><i data-lucide="tag" style="width:14px;height:14px;"></i> ${p.categoria}</div>` : ''}
                        ${p.requiere_receta ? `<div class="pill-info-chip" style="border-color:${p.requiere_receta.toLowerCase().includes('sí') || p.requiere_receta.toLowerCase().includes('retenida') ? '#ef4444' : '#10b981'};"><i data-lucide="file-text" style="width:14px;height:14px;"></i> Receta: ${p.requiere_receta}</div>` : ''}
                    </div>

                    ${p.dosis_habitual ? `<div class="pill-info-block pill-dosis"><span class="pill-info-label"><i data-lucide="clock" style="width:14px;height:14px;"></i> Dosis habitual (adultos)</span><p>${p.dosis_habitual}</p></div>` : ''}

                    ${(p.usos_comunes && p.usos_comunes.length) ? `<div class="pill-info-block"><span class="pill-info-label"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Usos comunes</span><ul class="pill-info-list">${p.usos_comunes.map(u => `<li>${u}</li>`).join('')}</ul></div>` : ''}

                    ${(p.efectos_secundarios && p.efectos_secundarios.length) ? `<div class="pill-info-block"><span class="pill-info-label"><i data-lucide="activity" style="width:14px;height:14px;"></i> Efectos secundarios comunes</span><ul class="pill-info-list">${p.efectos_secundarios.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}

                    ${(p.contraindicaciones && p.contraindicaciones.length) ? `<div class="pill-info-block pill-contra"><span class="pill-info-label"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> No usar si...</span><ul class="pill-info-list">${p.contraindicaciones.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}

                    ${(p.interacciones && p.interacciones.length) ? `<div class="pill-info-block"><span class="pill-info-label"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> Interactúa con</span><ul class="pill-info-list">${p.interacciones.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}

                    ${p.advertencia ? `<div class="pill-info-warning"><i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> ${p.advertencia}</div>` : ''}

                    <div class="pill-disclaimer">
                        <i data-lucide="info" style="width:13px;height:13px;"></i>
                        Esta información es orientativa y generada por IA. Consulta SIEMPRE a un médico o farmacéutico antes de tomar cualquier medicamento.
                    </div>
                </div>

                ${p.buscar ? `
                <button class="btn-premium pill-compare-btn" onclick="buscarDesdeIdentificador('${p.buscar.replace(/'/g, "\\'")}')">
                    <i data-lucide="bar-chart-2"></i> Comparar precios de "${p.buscar}" en farmacias
                </button>` : ''}
            </div>`;

        lucide.createIcons();

    } catch {
        resultDiv.innerHTML = `<div class="pill-error">No se pudo conectar con el servidor.</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="search"></i> Identificar medicamento';
        lucide.createIcons();
    }
}

function buscarDesdeIdentificador(termino) {
    const searchInput = document.getElementById('manual-search');
    searchInput.value = termino;
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(b => {
        if (b.textContent.trim().includes('Comparador')) {
            showSection('search', b);
        }
    });
    startScraping();
}

// =========================================================
// PANEL DE ADMINISTRADOR
// =========================================================
async function abrirAdmin(btn) {
    showSection('admin', btn);
    await cargarStats();
    await cargarUsuarios();
}

function adminTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['usuarios', 'reportes', 'historial', 'medicamentos'].forEach(t => {
        document.getElementById('admin-panel-' + t).style.display = (t === tab) ? 'block' : 'none';
    });
    if (tab === 'usuarios') cargarUsuarios();
    if (tab === 'reportes') cargarReportesAdmin();
    if (tab === 'historial') cargarHistorialAdmin();
    if (tab === 'medicamentos') cargarMedicamentosAdmin();
}

async function cargarStats() {
    try {
        const r = await fetch(`${API}/admin/stats`, { headers: authHeaders() });
        if (!r.ok) return;
        const s = await r.json();
        document.getElementById('stat-usuarios').textContent = s.usuarios;
        document.getElementById('stat-admins').textContent = s.admins;
        document.getElementById('stat-meds').textContent = s.medicamentos;
        document.getElementById('stat-busquedas').textContent = s.busquedas;
        document.getElementById('stat-pendientes').textContent = s.reportes_pendientes || 0;
        // Badge en la pestaña de reportes
        const badge = document.getElementById('admin-reportes-badge');
        if (s.reportes_pendientes > 0) {
            badge.textContent = s.reportes_pendientes;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { console.error(e); }
}

// ---- REPORTES COMUNITARIOS (ADMIN) ----
let adminReportesFiltro = 'pendiente';

async function cargarReportesAdmin() {
    const cont = document.getElementById('admin-panel-reportes');
    cont.innerHTML = '<p class="admin-loading">Cargando reportes...</p>';
    try {
        const r = await fetch(`${API}/admin/reportes?estado=${adminReportesFiltro}`, { headers: authHeaders() });
        if (!r.ok) { cont.innerHTML = '<p class="admin-loading">Acceso denegado.</p>'; return; }
        const reportes = await r.json();

        let filtroBtns = `<div class="admin-rep-filters">
            <button class="admin-rep-filter ${adminReportesFiltro === 'pendiente' ? 'active' : ''}" onclick="filtrarReportesAdmin('pendiente')">Pendientes</button>
            <button class="admin-rep-filter ${adminReportesFiltro === 'aprobado' ? 'active' : ''}" onclick="filtrarReportesAdmin('aprobado')">Aprobados</button>
            <button class="admin-rep-filter ${adminReportesFiltro === 'rechazado' ? 'active' : ''}" onclick="filtrarReportesAdmin('rechazado')">Rechazados</button>
            <button class="admin-rep-filter ${adminReportesFiltro === 'todos' ? 'active' : ''}" onclick="filtrarReportesAdmin('todos')">Todos</button>
        </div>`;

        if (!reportes || reportes.length === 0) {
            cont.innerHTML = filtroBtns + '<p class="admin-loading">No hay reportes en esta categoría.</p>';
            return;
        }

        let html = filtroBtns + `<table class="admin-table">
            <thead><tr><th>Usuario</th><th>Medicamento</th><th>Farmacia</th><th>Precio</th><th>Comuna</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr></thead><tbody>`;
        reportes.forEach(rep => {
            const estadoBadge = {
                pendiente: '<span class="badge" style="background:#fef3c7;color:#92400e;">Pendiente</span>',
                aprobado: '<span class="badge badge-barato">Aprobado</span>',
                rechazado: '<span class="badge" style="background:#fee2e2;color:#991b1b;">Rechazado</span>'
            }[rep.estado] || rep.estado;

            let acciones = '';
            if (rep.estado === 'pendiente') {
                acciones = `<button class="admin-btn-aprobar" onclick="aprobarReporte(${rep.id})">✓ Aprobar</button>
                    <button class="admin-btn-rechazar" onclick="rechazarReporte(${rep.id})">✕ Rechazar</button>`;
            } else {
                acciones = '<span style="color:var(--text-muted);font-size:0.8rem;">—</span>';
            }

            html += `<tr>
                <td>${rep.usuario || 'Anónimo'}</td>
                <td><strong>${rep.medicamento}</strong></td>
                <td>${rep.farmacia}</td>
                <td style="font-weight:700;color:#10b981;">$${rep.precio.toLocaleString('es-CL')}</td>
                <td>${rep.comuna || '—'}</td>
                <td>${estadoBadge}</td>
                <td style="text-align:right;white-space:nowrap;">${acciones}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
    } catch (e) {
        cont.innerHTML = '<p class="admin-loading">Error al cargar reportes.</p>';
    }
}

function filtrarReportesAdmin(filtro) {
    adminReportesFiltro = filtro;
    cargarReportesAdmin();
}

async function aprobarReporte(id) {
    try {
        await fetch(`${API}/admin/reportes/${id}/aprobar`, { method: 'POST', headers: authHeaders() });
        cargarReportesAdmin();
        cargarStats();
    } catch {}
}

async function rechazarReporte(id) {
    const motivo = prompt('Motivo del rechazo (se le mostrará al usuario):', 'El precio no parece realista.');
    if (motivo === null) return;
    try {
        await fetch(`${API}/admin/reportes/${id}/rechazar`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ motivo })
        });
        cargarReportesAdmin();
        cargarStats();
    } catch {}
}

// ---- USUARIOS ----
async function cargarUsuarios() {
    const cont = document.getElementById('admin-panel-usuarios');
    cont.innerHTML = '<p class="admin-loading">Cargando usuarios...</p>';
    try {
        const r = await fetch(`${API}/admin/usuarios`, { headers: authHeaders() });
        if (!r.ok) { cont.innerHTML = '<p class="admin-loading">Acceso denegado.</p>'; return; }
        const usuarios = await r.json();

        let html = `<table class="admin-table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Rol</th><th style="text-align:right;">Acciones</th></tr></thead><tbody>`;
        usuarios.forEach(u => {
            html += `<tr>
                <td>${u.id}</td>
                <td>${u.nombre}</td>
                <td>${u.correo}</td>
                <td>${u.es_admin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-normal">Usuario</span>'}</td>
                <td style="text-align:right;white-space:nowrap;">
                    <button class="admin-btn-icon" title="Editar"
                        onclick='abrirModalUsuario(${JSON.stringify(u)})'><i data-lucide="edit"></i></button>
                    <button class="admin-btn-icon danger" title="Eliminar"
                        onclick="eliminarUsuario(${u.id}, '${u.nombre.replace(/'/g, "")}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
        lucide.createIcons();
    } catch (e) {
        cont.innerHTML = '<p class="admin-loading">Error de conexión.</p>';
    }
}

function abrirModalUsuario(u) {
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-nombre').value = u.nombre;
    document.getElementById('edit-user-correo').value = u.correo;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-admin').checked = !!u.es_admin;
    document.getElementById('edit-user-alert').style.display = 'none';
    document.getElementById('edit-user-modal').style.display = 'flex';
    lucide.createIcons();
}

function cerrarModalUsuario() {
    document.getElementById('edit-user-modal').style.display = 'none';
}

async function guardarUsuario() {
    const id       = document.getElementById('edit-user-id').value;
    const nombre   = document.getElementById('edit-user-nombre').value.trim();
    const correo   = document.getElementById('edit-user-correo').value.trim();
    const password = document.getElementById('edit-user-password').value;
    const es_admin = document.getElementById('edit-user-admin').checked;
    const alertEl  = document.getElementById('edit-user-alert');

    try {
        const r = await fetch(`${API}/admin/usuarios/${id}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ nombre, correo, password, es_admin })
        });
        const data = await r.json();
        if (!r.ok) {
            alertEl.textContent = data.error || 'Error al guardar.';
            alertEl.style.display = 'block';
            return;
        }
        cerrarModalUsuario();
        await cargarStats();
        await cargarUsuarios();
    } catch {
        alertEl.textContent = 'Error de conexión con el servidor.';
        alertEl.style.display = 'block';
    }
}

async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
        const r = await fetch(`${API}/admin/usuarios/${id}`, { method: 'DELETE', headers: authHeaders() });
        const data = await r.json();
        if (!r.ok) { alert(data.error || 'No se pudo eliminar.'); return; }
        await cargarStats();
        await cargarUsuarios();
    } catch { alert('Error de conexión.'); }
}

// ---- HISTORIAL ----
async function cargarHistorialAdmin() {
    const cont = document.getElementById('admin-panel-historial');
    cont.innerHTML = '<p class="admin-loading">Cargando historial...</p>';
    try {
        const r = await fetch(`${API}/admin/historial`, { headers: authHeaders() });
        if (!r.ok) { cont.innerHTML = '<p class="admin-loading">Acceso denegado.</p>'; return; }
        const rows = await r.json();
        if (rows.length === 0) { cont.innerHTML = '<p class="admin-loading">Sin registros todavía.</p>'; return; }

        let html = `<table class="admin-table">
            <thead><tr><th>Buscado</th><th>Farmacia</th><th>Producto</th><th>Precio</th><th>Usuario</th><th>Fecha</th><th></th></tr></thead><tbody>`;
        rows.forEach(h => {
            html += `<tr>
                <td>${h.buscado}</td>
                <td>${h.farmacia}</td>
                <td style="max-width:200px;">${h.producto}</td>
                <td style="color:#10b981;font-weight:600;">$${Number(h.precio).toLocaleString('es-CL')}</td>
                <td>${h.usuario}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${h.fecha ? h.fecha.substring(0,16) : ''}</td>
                <td style="text-align:right;">
                    <button class="admin-btn-icon danger" title="Eliminar"
                        onclick="eliminarHistorial(${h.id})"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
        lucide.createIcons();
    } catch {
        cont.innerHTML = '<p class="admin-loading">Error de conexión.</p>';
    }
}

async function eliminarHistorial(id) {
    if (!confirm('¿Eliminar este registro del historial?')) return;
    try {
        const r = await fetch(`${API}/admin/historial/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (!r.ok) { alert('No se pudo eliminar.'); return; }
        await cargarStats();
        await cargarHistorialAdmin();
    } catch { alert('Error de conexión.'); }
}

// ---- MEDICAMENTOS ----
async function cargarMedicamentosAdmin() {
    const cont = document.getElementById('admin-panel-medicamentos');
    cont.innerHTML = '<p class="admin-loading">Cargando medicamentos...</p>';
    try {
        const r = await fetch(`${API}/admin/medicamentos`, { headers: authHeaders() });
        if (!r.ok) { cont.innerHTML = '<p class="admin-loading">Acceso denegado.</p>'; return; }
        const meds = await r.json();
        if (meds.length === 0) { cont.innerHTML = '<p class="admin-loading">Catálogo vacío.</p>'; return; }

        let html = `<table class="admin-table">
            <thead><tr><th>ID</th><th>Medicamento</th><th>Búsquedas registradas</th><th style="text-align:right;">Acciones</th></tr></thead><tbody>`;
        meds.forEach(m => {
            html += `<tr>
                <td>${m.id}</td>
                <td style="text-transform:uppercase;font-weight:500;">${m.nombre}</td>
                <td>${m.busquedas}</td>
                <td style="text-align:right;">
                    <button class="admin-btn-icon danger" title="Eliminar"
                        onclick="eliminarMedicamento(${m.id}, '${m.nombre.replace(/'/g, "")}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
        lucide.createIcons();
    } catch {
        cont.innerHTML = '<p class="admin-loading">Error de conexión.</p>';
    }
}

async function eliminarMedicamento(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}" y todo su historial asociado?`)) return;
    try {
        const r = await fetch(`${API}/admin/medicamentos/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (!r.ok) { alert('No se pudo eliminar.'); return; }
        await cargarStats();
        await cargarMedicamentosAdmin();
    } catch { alert('Error de conexión.'); }
}

// =========================================================
// ALERTAS DE PRECIO
// =========================================================

async function verificarAlertas() {
    if (!getToken()) {
        document.getElementById('notif-wrapper').style.display = 'none';
        return;
    }
    document.getElementById('notif-wrapper').style.display = 'block';

    try {
        const r = await fetch(`${API}/alertas/verificar`, { headers: authHeaders() });
        if (!r.ok) return;
        const disparadas = await r.json();

        const countEl = document.getElementById('notif-count');
        const listEl = document.getElementById('notif-list');

        if (disparadas.length > 0) {
            countEl.textContent = disparadas.length;
            countEl.style.display = 'flex';

            let html = '';
            disparadas.forEach(a => {
                html += `<div class="notif-item notif-triggered">
                    <div class="notif-item-icon">💰</div>
                    <div class="notif-item-text">
                        <strong>${a.medicamento.toUpperCase()}</strong> bajó a
                        <span class="notif-price">$${a.precio_actual.toLocaleString('es-CL')}</span>
                        en <strong>${a.farmacia}</strong>
                        <span class="notif-meta">Tu umbral: $${a.umbral.toLocaleString('es-CL')}</span>
                    </div>
                    <button class="notif-action-btn" onclick="document.getElementById('manual-search').value='${a.medicamento}'; irASeccion('search'); startScraping(); toggleNotifPanel();">
                        Ver
                    </button>
                </div>`;
            });
            listEl.innerHTML = html;
        } else {
            countEl.style.display = 'none';
            listEl.innerHTML = '<div class="notif-empty">Sin alertas disparadas. Tus precios aún no han bajado del umbral.</div>';
        }
    } catch (e) {
        console.error("Error verificando alertas:", e);
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Cerrar panel al hacer clic fuera
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notif-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('notif-panel').style.display = 'none';
    }
});

function abrirModalAlerta(nombre, precioActual) {
    if (!getToken()) { pedirLogin(); return; }
    document.getElementById('alert-med-name').value = nombre;
    document.getElementById('alert-precio-actual').value = `$${precioActual} CLP`;
    // Sugerir un umbral un 10-20% menor que el precio actual
    const val = parseInt(String(precioActual).replace(/\D/g, ''), 10);
    if (val) {
        document.getElementById('alert-umbral').value = Math.round(val * 0.85);
    }
    document.getElementById('alert-modal').style.display = 'flex';
    lucide.createIcons();
}

function cerrarModalAlerta() {
    document.getElementById('alert-modal').style.display = 'none';
}

async function confirmarAlerta() {
    const medicamento = document.getElementById('alert-med-name').value.trim();
    const umbral = parseInt(document.getElementById('alert-umbral').value, 10);
    if (!medicamento || !umbral || umbral <= 0) {
        alert('Ingresa un precio umbral válido.');
        return;
    }

    try {
        const r = await fetch(`${API}/alertas`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ medicamento: medicamento, umbral_precio: umbral })
        });
        const data = await r.json();
        if (data.error) {
            alert(data.error);
            return;
        }
        cerrarModalAlerta();
        // Feedback visual
        const res = document.getElementById('scraping-results');
        const notice = document.createElement('div');
        notice.className = 'alert-created-notice';
        notice.innerHTML = `<i data-lucide="bell-ring" style="width:16px;height:16px;"></i> ${data.mensaje}`;
        res.insertBefore(notice, res.firstChild);
        lucide.createIcons();
        setTimeout(() => notice.remove(), 6000);
    } catch {
        alert('Error al crear la alerta.');
    }
}

async function abrirGestionAlertas() {
    document.getElementById('notif-panel').style.display = 'none';
    document.getElementById('alertas-gestion-modal').style.display = 'flex';
    const listEl = document.getElementById('alertas-gestion-list');
    listEl.innerHTML = '<p style="color:var(--text-muted);padding:12px;">Cargando...</p>';

    try {
        const r = await fetch(`${API}/alertas`, { headers: authHeaders() });
        const alertas = await r.json();
        if (!alertas || alertas.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">No tienes alertas activas.</p>';
            return;
        }

        let html = '';
        alertas.forEach(a => {
            html += `<div class="alerta-gestion-item">
                <div class="alerta-gestion-info">
                    <strong>${a.medicamento.toUpperCase()}</strong>
                    <span>Avisarme cuando baje de <strong>$${a.umbral.toLocaleString('es-CL')} CLP</strong></span>
                    <span class="notif-meta">Creada: ${a.fecha ? a.fecha.substring(0, 10) : '—'}</span>
                </div>
                <button class="admin-btn-icon danger" onclick="eliminarAlertaYRefrescar(${a.id})" title="Eliminar alerta">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>`;
        });
        listEl.innerHTML = html;
        lucide.createIcons();
    } catch {
        listEl.innerHTML = '<p style="color:#ef4444;padding:12px;">Error al cargar alertas.</p>';
    }
}

async function eliminarAlertaYRefrescar(id) {
    try {
        await fetch(`${API}/alertas/${id}`, { method: 'DELETE', headers: authHeaders() });
        abrirGestionAlertas();
        verificarAlertas();
    } catch { }
}

// =========================================================
// OPTIMIZADOR DE RECETA COMPLETA
// =========================================================
let optBase64 = null;
let optMedicamentos = [];

function optFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        optBase64 = ev.target.result.split(',')[1];
        const img = document.getElementById('opt-preview-img');
        img.src = ev.target.result;
        img.style.display = 'block';
        document.getElementById('opt-placeholder').style.display = 'none';
        document.getElementById('opt-extract-btn').disabled = false;
        document.getElementById('opt-clear-btn').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function limpiarOptimizador() {
    optBase64 = null;
    optMedicamentos = [];
    document.getElementById('opt-file-input').value = '';
    document.getElementById('opt-preview-img').style.display = 'none';
    document.getElementById('opt-placeholder').style.display = 'flex';
    document.getElementById('opt-extract-btn').disabled = true;
    document.getElementById('opt-clear-btn').style.display = 'none';
    document.getElementById('opt-step-meds').style.display = 'none';
    document.getElementById('opt-step-results').style.display = 'none';
}

async function extraerReceta() {
    if (!optBase64) return;
    const btn = document.getElementById('opt-extract-btn');
    const medsDiv = document.getElementById('opt-step-meds');
    btn.disabled = true;
    btn.innerHTML = '<div class="auth-spinner"></div> Analizando receta...';

    try {
        const r = await fetch(`${API}/extraer_receta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagen_base64: optBase64 })
        });
        const data = await r.json();

        if (data.error || !data.medicamentos || data.medicamentos.length === 0) {
            medsDiv.innerHTML = `<div class="pill-error" style="margin-top:16px;">No se pudieron extraer medicamentos de la receta. Intenta con una foto más nítida.</div>`;
            medsDiv.style.display = 'block';
            return;
        }

        optMedicamentos = data.medicamentos;

        let html = `<div class="opt-meds-card">
            <h3>Medicamentos detectados en la receta</h3>
            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">Puedes editar los nombres antes de buscar. Elimina los que no necesites.</p>
            <div class="opt-meds-list">`;

        optMedicamentos.forEach((m, i) => {
            html += `<div class="opt-med-row" id="opt-med-${i}">
                <span class="opt-med-num">${i + 1}</span>
                <input type="text" class="input-premium opt-med-input" value="${m.buscar || m.nombre}" data-index="${i}">
                <button class="pill-clear-btn" onclick="document.getElementById('opt-med-${i}').remove()" style="display:inline-flex;padding:6px 10px;">
                    <i data-lucide="x" style="width:14px;height:14px;"></i>
                </button>
            </div>`;
        });

        html += `</div>
            <button class="btn-premium" style="margin-top:16px;width:100%;justify-content:center;" onclick="optimizarPrecios()">
                <i data-lucide="zap"></i> Buscar precios y optimizar
            </button>
        </div>`;

        medsDiv.innerHTML = html;
        medsDiv.style.display = 'block';
        lucide.createIcons();
    } catch {
        medsDiv.innerHTML = `<div class="pill-error" style="margin-top:16px;">Error al conectar con el servidor.</div>`;
        medsDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="scan"></i> Extraer medicamentos';
        lucide.createIcons();
    }
}

async function optimizarPrecios() {
    const inputs = document.querySelectorAll('.opt-med-input');
    const nombres = Array.from(inputs).map(inp => inp.value.trim()).filter(n => n);

    if (nombres.length === 0) { alert('No hay medicamentos para buscar.'); return; }
    if (!getToken()) { pedirLogin(); return; }

    const resultsDiv = document.getElementById('opt-step-results');
    resultsDiv.style.display = 'block';

    // Crear indicadores de progreso
    let progressHtml = '<div class="opt-progress"><h3>Buscando precios en farmacias...</h3>';
    progressHtml += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">Procesando de a uno para no saturar el sistema (' + nombres.length + ' medicamentos).</p>';
    progressHtml += '<div class="opt-progress-list">';
    nombres.forEach((n, i) => {
        progressHtml += '<div class="opt-progress-item" id="opt-prog-' + i + '">' +
            '<span style="color:var(--text-muted);">\u23f3</span> ' +
            '<span>' + n + '</span> ' +
            '<span style="color:var(--text-muted);font-size:0.78rem;">pendiente</span></div>';
    });
    progressHtml += '</div></div>';
    resultsDiv.innerHTML = progressHtml;

    const todosResultadosReceta = {};

    // Procesar UNO POR UNO (secuencial) para no abrir 36 Chrome a la vez
    for (let i = 0; i < nombres.length; i++) {
        const nombre = nombres[i];
        const progEl = document.getElementById('opt-prog-' + i);

        if (progEl) progEl.innerHTML = '<div class="auth-spinner" style="width:14px;height:14px;border-width:2px;"></div>' +
            ' <span>' + nombre + '</span> <span style="color:var(--text-muted);font-size:0.78rem;">buscando en farmacias...</span>';

        try {
            const r = await fetch(API + '/scraping_manual', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ remedio: nombre })
            });
            const data = await r.json();
            todosResultadosReceta[nombre] = data.precios || [];

            const count = (data.precios || []).length;
            if (progEl) progEl.innerHTML = '<span style="color:#10b981;">\u2713</span>' +
                ' <span>' + nombre + '</span>' +
                ' <span style="color:var(--text-muted);font-size:0.78rem;">' + count + ' resultado' + (count !== 1 ? 's' : '') + '</span>';
        } catch(e) {
            todosResultadosReceta[nombre] = [];
            if (progEl) progEl.innerHTML = '<span style="color:#ef4444;">\u2717</span>' +
                ' <span>' + nombre + '</span>' +
                ' <span style="color:var(--text-muted);font-size:0.78rem;">error</span>';
        }
    }

    mostrarOptimizacion(todosResultadosReceta);
}

function mostrarOptimizacion(resultadosPorMed) {
    const resultsDiv = document.getElementById('opt-step-results');
    const meds = Object.keys(resultadosPorMed);
    const parseP = str => parseInt(String(str).replace(/\D/g, ''), 10) || Infinity;

    // Para cada medicamento, encontrar el más barato por farmacia
    const mejorPorMed = {};
    const farmacias = ['Ahumada', 'Dr. Simi', 'Salcobrand', 'Cruz Verde'];

    meds.forEach(med => {
        const resultados = resultadosPorMed[med];
        if (!resultados || resultados.length === 0) {
            mejorPorMed[med] = { mejor: null, porFarmacia: {} };
            return;
        }
        const porFarmacia = {};
        resultados.forEach(r => {
            const val = parseP(r.precio);
            if (!porFarmacia[r.farmacia] || val < parseP(porFarmacia[r.farmacia].precio)) {
                porFarmacia[r.farmacia] = { ...r, val };
            }
        });
        const mejor = Object.values(porFarmacia).sort((a, b) => a.val - b.val)[0];
        mejorPorMed[med] = { mejor, porFarmacia };
    });

    // Estrategia 1: Compra óptima (el más barato de cada med, sin importar farmacia)
    let totalOptimo = 0;
    const detalleOptimo = [];
    meds.forEach(med => {
        const m = mejorPorMed[med];
        if (m.mejor) {
            totalOptimo += m.mejor.val;
            detalleOptimo.push({ med, farmacia: m.mejor.farmacia, precio: m.mejor.val, color: m.mejor.color, nombre: m.mejor.nombre });
        }
    });

    // Estrategia 2: Mejor farmacia única
    const totalesPorFarmacia = {};
    farmacias.forEach(f => {
        let total = 0;
        let completa = true;
        meds.forEach(med => {
            const m = mejorPorMed[med];
            if (m.porFarmacia[f]) {
                total += m.porFarmacia[f].val;
            } else {
                completa = false;
            }
        });
        if (completa) totalesPorFarmacia[f] = total;
    });

    const mejorFarmaciaUnica = Object.entries(totalesPorFarmacia).sort((a, b) => a[1] - b[1])[0];
    const ahorro = mejorFarmaciaUnica ? mejorFarmaciaUnica[1] - totalOptimo : 0;

    // Renderizar resultados
    let html = `<div class="opt-result-card">
        <h3>Resultado de la optimización</h3>

        <div class="opt-strategies">
            <div class="opt-strategy opt-strategy-best">
                <div class="opt-strat-header">
                    <span class="opt-strat-badge best">💰 Compra óptima</span>
                    <span class="opt-strat-total">$${totalOptimo.toLocaleString('es-CL')} <small>CLP</small></span>
                </div>
                <p class="opt-strat-desc">Comprando lo más barato de cada medicamento en distintas farmacias.</p>
                <div class="opt-strat-items">`;

    detalleOptimo.forEach(d => {
        html += `<div class="opt-strat-item">
            <div class="carousel-dot" style="background:${d.color};"></div>
            <span class="opt-item-med">${d.med}</span>
            <span class="opt-item-farm" style="color:${d.color};">${d.farmacia}</span>
            <span class="opt-item-price">$${d.precio.toLocaleString('es-CL')}</span>
        </div>`;
    });

    html += `</div></div>`;

    if (mejorFarmaciaUnica) {
        html += `<div class="opt-strategy">
            <div class="opt-strat-header">
                <span class="opt-strat-badge single">🏪 Mejor farmacia única</span>
                <span class="opt-strat-total">$${mejorFarmaciaUnica[1].toLocaleString('es-CL')} <small>CLP</small></span>
            </div>
            <p class="opt-strat-desc">Comprando todo en <strong>${mejorFarmaciaUnica[0]}</strong> (sin tener que ir a varias).</p>
        </div>`;
    }

    if (ahorro > 0) {
        html += `<div class="opt-savings">
            <i data-lucide="trending-down" style="width:20px;height:20px;"></i>
            <span>Ahorras <strong>$${ahorro.toLocaleString('es-CL')} CLP</strong> comprando en la combinación óptima vs todo en ${mejorFarmaciaUnica[0]}.</span>
        </div>`;

        // Registrar este ahorro REAL de receta en el perfil del usuario
        if (getToken() && mejorFarmaciaUnica) {
            fetch(`${API}/registrar_ahorro_receta`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    medicamento: 'Receta médica',
                    precio_caro: mejorFarmaciaUnica[1],
                    precio_barato: totalOptimo
                })
            }).then(() => actualizarAhorroSidebar()).catch(() => {});
        }
    }

    html += `</div>

        <div class="opt-full-table">
            <h4>Detalle por medicamento y farmacia</h4>
            <div class="results-table-wrapper"><table class="results-table">
                <thead><tr><th>Medicamento</th>`;
    farmacias.forEach(f => { html += `<th style="text-align:center;">${f}</th>`; });
    html += `</tr></thead><tbody>`;

    meds.forEach(med => {
        html += `<tr><td><strong>${med}</strong></td>`;
        farmacias.forEach(f => {
            const m = mejorPorMed[med];
            if (m.porFarmacia[f]) {
                const esMejor = m.mejor && m.mejor.farmacia === f;
                html += `<td style="text-align:center;${esMejor ? 'font-weight:800;color:#10b981;' : ''}">$${m.porFarmacia[f].val.toLocaleString('es-CL')}</td>`;
            } else {
                html += `<td style="text-align:center;color:var(--text-muted);">—</td>`;
            }
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div></div>`;
    html += `</div>`;

    resultsDiv.innerHTML = html;
    lucide.createIcons();
}

// =========================================================
// CONFIGURACIÓN
// =========================================================

function abrirConfiguracion() {
    document.getElementById('settings-modal').style.display = 'flex';
    // Actualizar estado visual de las opciones
    updateSettingsUI();
    lucide.createIcons();
}

function cerrarConfiguracion() {
    document.getElementById('settings-modal').style.display = 'none';
}

function updateSettingsUI() {
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('theme-opt-light').classList.toggle('active', !isDark);
    document.getElementById('theme-opt-dark').classList.toggle('active', isDark);

    const lang = localStorage.getItem('fc_lang') || 'es';
    document.getElementById('lang-opt-es').classList.toggle('active', lang === 'es');
    document.getElementById('lang-opt-en').classList.toggle('active', lang === 'en');

    const font = localStorage.getItem('fc_font') || 'Inter';
    document.querySelectorAll('.settings-font-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-font') === font);
    });

    const notif = localStorage.getItem('fc_notif') !== 'off';
    document.getElementById('settings-notif-toggle').checked = notif;
    document.getElementById('settings-notif-text').textContent = notif ? 'Activadas' : 'Desactivadas';
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
    document.getElementById('theme-icon').setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    lucide.createIcons();
    updateSettingsUI();
    if (miGrafico) cargarHistorialFiltrado();
}

function setFont(fontName) {
    document.documentElement.style.setProperty('--font-family', `'${fontName}', sans-serif`);
    document.body.style.fontFamily = `'${fontName}', sans-serif`;
    localStorage.setItem('fc_font', fontName);
    updateSettingsUI();
}

function setIdioma(lang) {
    localStorage.setItem('fc_lang', lang);
    updateSettingsUI();
    aplicarIdioma(lang);
}

function toggleNotificaciones(enabled) {
    localStorage.setItem('fc_notif', enabled ? 'on' : 'off');
    document.getElementById('settings-notif-text').textContent = enabled ? 'Activadas' : 'Desactivadas';
    if (enabled) {
        verificarAlertas();
    } else {
        document.getElementById('notif-count').style.display = 'none';
    }
}

// Traducciones básicas
const TRADUCCIONES = {
    es: {
        'nav_inicio': 'Inicio', 'nav_mathew': 'Mathew IA', 'nav_comparador': 'Comparador',
        'nav_identificador': 'Identificador', 'nav_optimizador': 'Optimizador',
        'nav_historial': 'Historial', 'nav_mapa': 'Mapa Salud', 'nav_admin': 'Administración',
        'nav_interacciones': 'Interacciones', 'nav_turno': 'Farmacias de Turno',
        'hero_badge': 'Plataforma de Salud Inteligente',
        'hero_title': 'Bienvenido a',
        'hero_desc': 'Compara precios de medicamentos en tiempo real, identifica pastillas con inteligencia artificial, y consulta con nuestro asistente clínico Mathew.',
        'hero_btn1': 'Comparar precios', 'hero_btn2': 'Hablar con Mathew',
        'feat1_title': 'Comparador en Tiempo Real',
        'feat1_desc': 'Busca cualquier medicamento y compara precios en Ahumada, Dr. Simi, Salcobrand y Cruz Verde.',
        'feat2_title': 'Identificador de Pastillas',
        'feat2_desc': 'Sube una foto de cualquier pastilla y la IA te dice qué medicamento es.',
        'feat3_title': 'Asistente Mathew IA',
        'feat3_desc': 'Consulta síntomas o dudas de salud con nuestro chatbot clínico con entrada por voz.',
        'feat4_title': 'Mapa de Salud',
        'feat4_desc': 'Encuentra farmacias, clínicas y hospitales cercanos a tu ubicación.',
        'popular_title': 'Medicamentos más buscados',
        'popular_desc': 'Los precios más bajos encontrados por nuestro sistema.',
        'server_status': 'Servidor Local Activo',
        'comparar_btn': 'Comparar', 'limpiar_btn': 'Limpiar historial',
        'buscar_generico': 'Buscar alternativa genérica',
        'chat_placeholder': 'Escribe tu síntoma o habla con el micrófono...',
        'chat_welcome': '¡Hola! Bienvenido a <strong>FarmaConnect</strong>. ¿En qué malestar o síntoma puedo orientarte?',
        'identificar_btn': 'Identificar medicamento',
        'optimizar_title': 'Optimizador de Receta Completa',
        'optimizar_desc': 'Sube una foto de tu receta médica y el sistema encontrará la combinación más económica.',
        'historial_title': 'Evolución de Precio Histórico',
        'mapa_title': 'Sucursales Cercanas de Atención',
    },
    en: {
        'nav_inicio': 'Home', 'nav_mathew': 'Mathew AI', 'nav_comparador': 'Comparator',
        'nav_identificador': 'Pill ID', 'nav_optimizador': 'Optimizer',
        'nav_historial': 'History', 'nav_mapa': 'Health Map', 'nav_admin': 'Admin',
        'nav_interacciones': 'Interactions', 'nav_turno': 'Pharmacies on Duty',
        'hero_badge': 'Smart Health Platform',
        'hero_title': 'Welcome to',
        'hero_desc': 'Compare drug prices in real time, identify pills with artificial intelligence, and consult with our clinical assistant Mathew.',
        'hero_btn1': 'Compare prices', 'hero_btn2': 'Talk to Mathew',
        'feat1_title': 'Real-Time Comparator',
        'feat1_desc': 'Search any medicine and compare prices across Ahumada, Dr. Simi, Salcobrand and Cruz Verde.',
        'feat2_title': 'Pill Identifier',
        'feat2_desc': 'Upload a photo of any pill and AI will tell you what medicine it is.',
        'feat3_title': 'Mathew AI Assistant',
        'feat3_desc': 'Ask about symptoms or health questions with our clinical chatbot with voice input.',
        'feat4_title': 'Health Map',
        'feat4_desc': 'Find nearby pharmacies, clinics and hospitals using your location.',
        'popular_title': 'Most searched medicines',
        'popular_desc': 'The lowest prices found by our scraping system.',
        'server_status': 'Local Server Active',
        'comparar_btn': 'Compare', 'limpiar_btn': 'Clear history',
        'buscar_generico': 'Search generic alternative',
        'chat_placeholder': 'Type your symptom or speak with the microphone...',
        'chat_welcome': 'Hello! Welcome to <strong>FarmaConnect</strong>. How can I help you with your health today?',
        'identificar_btn': 'Identify medicine',
        'optimizar_title': 'Complete Prescription Optimizer',
        'optimizar_desc': 'Upload a photo of your prescription and the system will find the cheapest combination.',
        'historial_title': 'Historical Price Evolution',
        'mapa_title': 'Nearby Health Locations',
    }
};

function aplicarIdioma(lang) {
    const tr = TRADUCCIONES[lang] || TRADUCCIONES['es'];
    // Traducir todos los elementos con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (tr[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = tr[key];
            } else {
                el.innerHTML = tr[key];
            }
        }
    });
    lucide.createIcons();
}

// Aplicar preferencias guardadas al cargar
document.addEventListener('DOMContentLoaded', () => {
    const font = localStorage.getItem('fc_font');
    if (font && font !== 'Inter') setFont(font);
    const lang = localStorage.getItem('fc_lang');
    if (lang && lang !== 'es') aplicarIdioma(lang);
});

// =========================================================
// SKELETON LOADERS
// =========================================================

function renderSkeletonTabla() {
    // Genera 6 filas skeleton con anchos variables para verse natural
    const anchos = [
        { farm: 80, prod: 220, precio: 70 },
        { farm: 70, prod: 180, precio: 65 },
        { farm: 90, prod: 250, precio: 75 },
        { farm: 75, prod: 200, precio: 60 },
        { farm: 85, prod: 160, precio: 70 },
        { farm: 70, prod: 230, precio: 65 }
    ];

    let filas = '';
    anchos.forEach((a, i) => {
        filas += `<tr class="skeleton-row" style="animation-delay:${i * 0.08}s;">
            <td>
                <div class="farmacia-cell">
                    <div class="sk sk-circle"></div>
                    <div class="sk sk-bar" style="width:${a.farm}px;height:14px;"></div>
                </div>
            </td>
            <td><div class="sk sk-bar" style="width:${a.prod}px;height:14px;"></div></td>
            <td>
                <div class="sk sk-bar" style="width:${a.precio}px;height:20px;margin-bottom:4px;"></div>
                <div class="sk sk-bar" style="width:${a.precio - 25}px;height:10px;"></div>
            </td>
            <td><div class="sk sk-pill" style="width:90px;"></div></td>
            <td style="text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <div class="sk sk-square"></div>
                    <div class="sk sk-pill" style="width:84px;"></div>
                </div>
            </td>
        </tr>`;
    });

    return `
        <div class="skeleton-summary">
            <div class="sk sk-pill" style="width:95px;"></div>
            <div class="sk sk-pill" style="width:85px;"></div>
            <div class="sk sk-pill" style="width:100px;"></div>
            <div class="sk sk-bar" style="width:110px;height:13px;"></div>
            <span class="skeleton-status"><span class="skeleton-status-dot"></span> Consultando 4 farmacias...</span>
        </div>
        <div class="results-table-wrapper">
            <table class="results-table">
                <thead><tr>
                    <th>Farmacia</th><th>Producto encontrado</th><th>Precio</th><th>Estado</th><th style="text-align:right;">Acción</th>
                </tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// =========================================================
// PRECIOS COMUNITARIOS (tipo Waze)
// =========================================================

function abrirModalReporte() {
    if (!getToken()) { pedirLogin(); return; }
    // Pre-llenar con el término buscado
    const q = document.getElementById('manual-search').value.trim();
    if (q) document.getElementById('reporte-med').value = q;
    document.getElementById('reporte-modal').style.display = 'flex';
    lucide.createIcons();
}

function cerrarModalReporte() {
    document.getElementById('reporte-modal').style.display = 'none';
}

async function enviarReporte() {
    const medicamento = document.getElementById('reporte-med').value.trim();
    const farmacia = document.getElementById('reporte-farmacia').value;
    const precio = document.getElementById('reporte-precio').value;
    const comuna = document.getElementById('reporte-comuna').value.trim();

    if (!medicamento || !farmacia || !precio) {
        alert('Completa medicamento, farmacia y precio.');
        return;
    }

    try {
        const r = await fetch(`${API}/comunidad/reportar`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ medicamento, farmacia, precio, comuna })
        });
        const data = await r.json();
        if (data.error) { alert(data.error); return; }
        cerrarModalReporte();
        // Limpiar campos
        ['reporte-med', 'reporte-precio', 'reporte-comuna'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('reporte-farmacia').value = '';
        // Recargar precios comunitarios si coincide con la búsqueda actual
        const q = document.getElementById('manual-search').value.trim();
        if (q) cargarPreciosComunidad(q);
        alert(data.mensaje);
    } catch {
        alert('Error al enviar el reporte.');
    }
}

async function cargarPreciosComunidad(medicamento) {
    const cont = document.getElementById('comunidad-precios');
    if (!medicamento) { cont.style.display = 'none'; return; }

    try {
        const r = await fetch(`${API}/comunidad/precios?medicamento=${encodeURIComponent(medicamento)}`);
        const reportes = await r.json();

        if (!reportes || reportes.length === 0) {
            cont.style.display = 'none';
            return;
        }

        let html = `<div class="comunidad-card">
            <div class="comunidad-header">
                <div>
                    <h3><i data-lucide="users" style="width:18px;height:18px;vertical-align:middle;"></i> Precios reportados por la comunidad</h3>
                    <p>Precios vistos en farmacias físicas por otros usuarios.</p>
                </div>
                <span class="comunidad-badge">${reportes.length} reporte${reportes.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="comunidad-list">`;

        reportes.forEach(rep => {
            const fecha = rep.fecha ? rep.fecha.substring(0, 10) : '';
            html += `<div class="comunidad-item">
                <div class="comunidad-item-main">
                    <span class="comunidad-precio">$${rep.precio.toLocaleString('es-CL')}</span>
                    <div class="comunidad-info">
                        <span class="comunidad-farmacia">${rep.farmacia}</span>
                        ${rep.comuna ? `<span class="comunidad-comuna"><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${rep.comuna}</span>` : ''}
                    </div>
                </div>
                <div class="comunidad-item-meta">
                    <span class="comunidad-usuario">por ${rep.usuario || 'Anónimo'} · ${fecha}</span>
                    <button class="comunidad-voto" onclick="votarPrecio(${rep.id}, this)">
                        <i data-lucide="thumbs-up" style="width:13px;height:13px;"></i> <span>${rep.votos}</span>
                    </button>
                </div>
            </div>`;
        });

        html += `</div></div>`;
        cont.innerHTML = html;
        cont.style.display = 'block';
        lucide.createIcons();
    } catch (e) {
        console.error("Error cargando precios comunidad:", e);
        cont.style.display = 'none';
    }
}

async function votarPrecio(id, btn) {
    try {
        await fetch(`${API}/comunidad/votar/${id}`, { method: 'POST', headers: authHeaders() });
        // Incrementar el contador visualmente
        const span = btn.querySelector('span');
        span.textContent = parseInt(span.textContent) + 1;
        btn.classList.add('voted');
        btn.disabled = true;
    } catch { }
}

// =========================================================
// ÍNDICE DE AHORRO PERSONAL + NIVEL DE REPORTERO
// =========================================================

async function actualizarAhorroSidebar() {
    if (!getToken()) return;
    try {
        const r = await fetch(`${API}/perfil/stats`, { headers: authHeaders() });
        if (!r.ok) return;
        const stats = await r.json();
        const el = document.getElementById('sidebar-savings');
        if (el && stats.ahorro_total > 0) {
            el.innerHTML = `💰 Ahorrado: $${stats.ahorro_total.toLocaleString('es-CL')}`;
        }
    } catch {}
}

async function abrirPerfil() {
    if (!getToken()) { pedirLogin(); return; }
    document.getElementById('perfil-modal').style.display = 'flex';
    const cont = document.getElementById('perfil-content');
    cont.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center;">Cargando...</p>';

    try {
        const r = await fetch(`${API}/perfil/stats`, { headers: authHeaders() });
        const s = await r.json();
        const nivel = s.nivel;

        // Barra de progreso al siguiente nivel
        let progresoHtml = '';
        if (nivel.siguiente) {
            progresoHtml = `<div class="perfil-progress">
                <div class="perfil-progress-text">
                    <span>Faltan <strong>${nivel.faltan}</strong> reportes para ${nivel.siguiente}</span>
                </div>
                <div class="perfil-progress-bar">
                    <div class="perfil-progress-fill" style="width:${Math.min(100, (s.num_reportes / (s.num_reportes + nivel.faltan)) * 100)}%;background:${nivel.color};"></div>
                </div>
            </div>`;
        } else {
            progresoHtml = `<div class="perfil-progress-text" style="text-align:center;color:#f59e0b;font-weight:700;">¡Nivel máximo alcanzado! 🏆</div>`;
        }

        cont.innerHTML = `
            <div class="perfil-hero">
                <div class="perfil-ahorro-big">
                    <span class="perfil-ahorro-label">Has ahorrado en total</span>
                    <span class="perfil-ahorro-monto">$${s.ahorro_total.toLocaleString('es-CL')}</span>
                    <span class="perfil-ahorro-sub">comparando precios con FarmaConnect</span>
                </div>
            </div>

            <div class="perfil-stats-row">
                <div class="perfil-stat">
                    <span class="perfil-stat-num">${s.num_comparaciones}</span>
                    <span class="perfil-stat-lbl">Comparaciones</span>
                </div>
                <div class="perfil-stat">
                    <span class="perfil-stat-num">${s.num_reportes}</span>
                    <span class="perfil-stat-lbl">Reportes</span>
                </div>
                <div class="perfil-stat">
                    <span class="perfil-stat-num">${s.total_votos}</span>
                    <span class="perfil-stat-lbl">Votos recibidos</span>
                </div>
            </div>

            <div class="perfil-nivel-card" style="border-color:${nivel.color};">
                <div class="perfil-nivel-icono">${nivel.icono}</div>
                <div class="perfil-nivel-info">
                    <span class="perfil-nivel-label">Nivel de Reportero</span>
                    <span class="perfil-nivel-nombre" style="color:${nivel.color};">${nivel.nivel}</span>
                </div>
            </div>
            ${progresoHtml}

            ${s.mejor_ahorro ? `<div class="perfil-mejor">
                <i data-lucide="trophy" style="width:16px;height:16px;color:#f59e0b;"></i>
                Tu mejor ahorro: <strong>$${s.mejor_ahorro.monto.toLocaleString('es-CL')}</strong> en ${s.mejor_ahorro.medicamento}
            </div>` : ''}

            <div id="perfil-reportes" style="margin-top:18px;"></div>
        `;
        lucide.createIcons();
        cargarMisReportes();
    } catch {
        cont.innerHTML = '<p style="color:#ef4444;padding:20px;">Error al cargar el perfil.</p>';
    }
}

// =========================================================
// DETECTOR DE INTERACCIONES
// =========================================================
let interMeds = [];

function agregarMedInteraccion() {
    const input = document.getElementById('inter-med-input');
    const val = input.value.trim();
    if (!val) return;
    if (!interMeds.includes(val.toLowerCase())) {
        interMeds.push(val);
        renderInterChips();
    }
    input.value = '';
    input.focus();
}

function renderInterChips() {
    const cont = document.getElementById('inter-chips');
    cont.innerHTML = interMeds.map((m, i) =>
        `<div class="inter-chip">${m}<button onclick="quitarMedInteraccion(${i})">✕</button></div>`
    ).join('');
    document.getElementById('inter-analyze-btn').disabled = interMeds.length < 2;
}

function quitarMedInteraccion(i) {
    interMeds.splice(i, 1);
    renderInterChips();
}

async function analizarInteracciones() {
    if (interMeds.length < 2) return;
    const btn = document.getElementById('inter-analyze-btn');
    const resultDiv = document.getElementById('inter-result');
    btn.disabled = true;
    btn.innerHTML = '<div class="auth-spinner"></div> Analizando...';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">La IA está analizando las interacciones...</p>';

    try {
        const r = await fetch(`${API}/interacciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medicamentos: interMeds })
        });
        const data = await r.json();
        if (data.error) {
            resultDiv.innerHTML = `<div class="pill-error">${data.error}</div>`;
            return;
        }

        const riesgoColor = { alto: '#ef4444', medio: '#f59e0b', bajo: '#eab308', ninguno: '#10b981' }[data.riesgo_general] || '#64748b';

        let html = `<div class="inter-result-card">
            <div class="inter-riesgo-header" style="border-color:${riesgoColor};">
                <div class="inter-riesgo-badge" style="background:${riesgoColor}20;color:${riesgoColor};">
                    Riesgo general: ${(data.riesgo_general || 'desconocido').toUpperCase()}
                </div>
                <p>${data.resumen || ''}</p>
            </div>`;

        if (data.interacciones && data.interacciones.length > 0) {
            html += '<div class="inter-list">';
            data.interacciones.forEach(inter => {
                const sevColor = { alta: '#ef4444', media: '#f59e0b', baja: '#eab308' }[inter.severidad] || '#64748b';
                html += `<div class="inter-item" style="border-left-color:${sevColor};">
                    <div class="inter-item-head">
                        <span class="inter-par">${inter.par}</span>
                        <span class="inter-sev" style="background:${sevColor}20;color:${sevColor};">${inter.severidad}</span>
                    </div>
                    <p class="inter-desc">${inter.descripcion}</p>
                    <p class="inter-reco"><strong>Recomendación:</strong> ${inter.recomendacion}</p>
                </div>`;
            });
            html += '</div>';
        } else {
            html += '<div class="inter-safe">✓ No se detectaron interacciones peligrosas conocidas entre estos medicamentos.</div>';
        }

        html += '</div>';
        resultDiv.innerHTML = html;
        lucide.createIcons();
    } catch {
        resultDiv.innerHTML = '<div class="pill-error">Error al analizar.</div>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="alert-triangle"></i> Analizar interacciones';
        lucide.createIcons();
    }
}

// =========================================================
// FARMACIAS DE TURNO
// =========================================================
async function buscarFarmaciasTurno() {
    const comuna = document.getElementById('turno-comuna').value.trim();
    const resultDiv = document.getElementById('turno-result');
    resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">Buscando farmacias de turno...</p>';

    try {
        const r = await fetch(`${API}/farmacias_turno?comuna=${encodeURIComponent(comuna)}`);
        const farmacias = await r.json();

        if (farmacias.error || !farmacias || farmacias.length === 0) {
            resultDiv.innerHTML = `<div class="turno-empty">
                <i data-lucide="clock" style="width:32px;height:32px;opacity:0.3;"></i>
                <p>No se encontraron farmacias de turno${comuna ? ' en ' + comuna : ''}. Intenta con otra comuna.</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        let html = `<div class="turno-count">${farmacias.length} farmacia${farmacias.length !== 1 ? 's' : ''} de turno encontrada${farmacias.length !== 1 ? 's' : ''}</div><div class="turno-list">`;
        farmacias.forEach(f => {
            html += `<div class="turno-item">
                <div class="turno-item-icon"><i data-lucide="cross" style="width:18px;height:18px;"></i></div>
                <div class="turno-item-info">
                    <span class="turno-nombre">${f.nombre}</span>
                    <span class="turno-dir"><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${f.direccion}, ${f.comuna}</span>
                    ${f.horario ? `<span class="turno-horario"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${f.horario}</span>` : ''}
                </div>
                ${f.lat && f.lng ? `<a href="https://www.google.com/maps?q=${f.lat},${f.lng}" target="_blank" class="turno-maps-btn"><i data-lucide="navigation" style="width:14px;height:14px;"></i> Ir</a>` : ''}
            </div>`;
        });
        html += '</div>';
        resultDiv.innerHTML = html;
        lucide.createIcons();
    } catch {
        resultDiv.innerHTML = '<div class="pill-error">Error al obtener farmacias de turno.</div>';
    }
}

// =========================================================
// CALCULADORA DE TRATAMIENTO
// =========================================================
function calcularTratamiento() {
    const tomas = parseInt(document.getElementById('calc-tomas').value) || 0;
    const dias = parseInt(document.getElementById('calc-dias').value) || 0;
    const unidades = parseInt(document.getElementById('calc-unidades').value) || 1;
    const resDiv = document.getElementById('calc-resultado');

    if (tomas <= 0 || dias <= 0 || unidades <= 0) {
        resDiv.innerHTML = '';
        return;
    }

    const totalUnidades = tomas * dias;
    const cajasNecesarias = Math.ceil(totalUnidades / unidades);

    // Precio más barato de los resultados actuales
    let precioMin = Infinity, farmaciaMin = '';
    todosResultados.forEach(p => {
        const val = parseInt(String(p.precio).replace(/\D/g, ''), 10);
        if (val && val < precioMin) { precioMin = val; farmaciaMin = p.farmacia; }
    });

    let costoHtml = '';
    if (precioMin !== Infinity) {
        const costoTotal = precioMin * cajasNecesarias;
        costoHtml = `<div class="calc-costo">
            <span>Costo total del tratamiento:</span>
            <strong>$${costoTotal.toLocaleString('es-CL')} CLP</strong>
            <small>(${cajasNecesarias} caja${cajasNecesarias !== 1 ? 's' : ''} × $${precioMin.toLocaleString('es-CL')} en ${farmaciaMin})</small>
        </div>`;
    }

    resDiv.innerHTML = `
        <div class="calc-result-grid">
            <div class="calc-result-item">
                <span class="calc-result-num">${totalUnidades}</span>
                <span class="calc-result-lbl">unidades totales</span>
            </div>
            <div class="calc-result-item highlight">
                <span class="calc-result-num">${cajasNecesarias}</span>
                <span class="calc-result-lbl">caja${cajasNecesarias !== 1 ? 's' : ''} a comprar</span>
            </div>
        </div>
        ${costoHtml}`;
}

// =========================================================
// MODO ADULTO MAYOR
// =========================================================
function toggleModoSenior(enabled) {
    document.body.classList.toggle('senior-mode', enabled);
    localStorage.setItem('fc_senior', enabled ? 'on' : 'off');
    document.getElementById('settings-senior-text').textContent = enabled ? 'Activado' : 'Desactivado';
}

// Aplicar modo senior guardado al cargar
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('fc_senior') === 'on') {
        document.body.classList.add('senior-mode');
        const toggle = document.getElementById('settings-senior-toggle');
        if (toggle) {
            toggle.checked = true;
            document.getElementById('settings-senior-text').textContent = 'Activado';
        }
    }
});

// Agregar mapping de las nuevas secciones a la navegación
const _origSectionMap = { 'interacciones': 'Interacciones', 'turno': 'Turno' };

async function cargarMisReportes() {
    const cont = document.getElementById('perfil-reportes');
    if (!cont) return;
    try {
        const r = await fetch(`${API}/comunidad/mis_reportes`, { headers: authHeaders() });
        const reportes = await r.json();
        if (!reportes || reportes.length === 0) return;

        let html = '<h4 style="font-size:0.95rem;font-weight:700;margin-bottom:10px;">Mis reportes</h4><div class="mis-reportes-list">';
        reportes.forEach(rep => {
            const estadoInfo = {
                pendiente: { label: 'En revisión', color: '#f59e0b', icon: '⏳' },
                aprobado: { label: 'Aprobado', color: '#10b981', icon: '✓' },
                rechazado: { label: 'Rechazado', color: '#ef4444', icon: '✕' }
            }[rep.estado] || { label: rep.estado, color: '#64748b', icon: '•' };

            html += `<div class="mi-reporte-item">
                <div class="mi-reporte-main">
                    <span class="mi-reporte-med">${rep.medicamento}</span>
                    <span class="mi-reporte-detalle">${rep.farmacia} · $${rep.precio.toLocaleString('es-CL')}</span>
                </div>
                <div class="mi-reporte-estado">
                    <span style="color:${estadoInfo.color};font-weight:700;font-size:0.82rem;">${estadoInfo.icon} ${estadoInfo.label}</span>
                    ${rep.estado === 'rechazado' && rep.motivo_rechazo ? `<span class="mi-reporte-motivo">${rep.motivo_rechazo}</span>` : ''}
                </div>
            </div>`;
        });
        html += '</div>';
        cont.innerHTML = html;
    } catch {}
}

// =========================================================
// COMUNAS DE CHILE
// =========================================================
const COMUNAS_CHILE = [
    "Arica","Iquique","Alto Hospicio","Antofagasta","Calama","Tocopilla","Copiapó","Vallenar",
    "La Serena","Coquimbo","Ovalle","Valparaíso","Viña del Mar","Quilpué","Villa Alemana","San Antonio","Quillota","Los Andes","San Felipe",
    "Santiago","Cerrillos","Cerro Navia","Conchalí","El Bosque","Estación Central","Huechuraba","Independencia","La Cisterna","La Florida","La Granja","La Pintana","La Reina","Las Condes","Lo Barnechea","Lo Espejo","Lo Prado","Macul","Maipú","Ñuñoa","Pedro Aguirre Cerda","Peñalolén","Providencia","Pudahuel","Quilicura","Quinta Normal","Recoleta","Renca","San Joaquín","San Miguel","San Ramón","Vitacura","Puente Alto","San Bernardo","Buin","Colina","Melipilla","Talagante","Peñaflor",
    "Rancagua","Machalí","San Fernando","Rengo","Curicó","Talca","Linares","Molina","Constitución","Cauquenes",
    "Chillán","Concepción","Talcahuano","Hualpén","San Pedro de la Paz","Chiguayante","Coronel","Lota","Los Ángeles","Cañete",
    "Temuco","Padre Las Casas","Villarrica","Pucón","Angol","Victoria",
    "Valdivia","La Unión","Osorno","Puerto Montt","Puerto Varas","Castro","Ancud","Quellón",
    "Coyhaique","Puerto Aysén","Punta Arenas","Puerto Natales"
].sort();

function llenarComunas(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    // Mantener la primera opción (placeholder)
    const placeholder = sel.querySelector('option');
    sel.innerHTML = '';
    if (placeholder) sel.appendChild(placeholder);
    COMUNAS_CHILE.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    llenarComunas('reporte-comuna');
    llenarComunas('turno-comuna');
});

// =========================================================
// FUERZA DE CONTRASEÑA
// =========================================================
function evaluarPassword(pw) {
    const cont = document.getElementById('pw-strength');
    if (!pw) { cont.classList.remove('visible'); return; }
    cont.classList.add('visible');

    let fuerza = 0;
    if (pw.length >= 8) fuerza++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) fuerza++;
    if (/\d/.test(pw)) fuerza++;
    if (/[^A-Za-z0-9]/.test(pw)) fuerza++;

    const colores = ['#ef4444', '#f59e0b', '#eab308', '#10b981'];
    const labels = ['Débil', 'Regular', 'Buena', 'Fuerte'];
    const color = colores[Math.max(0, fuerza - 1)];

    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('pw-bar-' + i);
        bar.style.background = i <= fuerza ? color : 'var(--border)';
    }
    const label = document.getElementById('pw-strength-label');
    label.textContent = fuerza > 0 ? labels[fuerza - 1] : '';
    label.style.color = color;
}

// =========================================================
// CARRUSEL DE FARMACIAS EN LOGIN
// =========================================================
let authSlideIndex = 0;
let authCarouselTimer = null;

function initAuthCarousel() {
    const slides = document.querySelectorAll('.auth-slide');
    const dotsCont = document.getElementById('auth-carousel-dots');
    if (!slides.length || !dotsCont) return;

    // Crear dots
    dotsCont.innerHTML = '';
    slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'auth-carousel-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => irAuthSlide(i);
        dotsCont.appendChild(dot);
    });

    // Auto-rotación cada 3 segundos
    if (authCarouselTimer) clearInterval(authCarouselTimer);
    authCarouselTimer = setInterval(() => {
        authSlideIndex = (authSlideIndex + 1) % slides.length;
        renderAuthSlide();
    }, 3000);
}

function irAuthSlide(i) {
    authSlideIndex = i;
    renderAuthSlide();
    if (authCarouselTimer) clearInterval(authCarouselTimer);
    authCarouselTimer = setInterval(() => {
        const slides = document.querySelectorAll('.auth-slide');
        authSlideIndex = (authSlideIndex + 1) % slides.length;
        renderAuthSlide();
    }, 3000);
}

function renderAuthSlide() {
    const slides = document.querySelectorAll('.auth-slide');
    const dots = document.querySelectorAll('.auth-carousel-dot');
    slides.forEach((s, i) => s.classList.toggle('active', i === authSlideIndex));
    dots.forEach((d, i) => d.classList.toggle('active', i === authSlideIndex));
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAuthCarousel, 100);
});
