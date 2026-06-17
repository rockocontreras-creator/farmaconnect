# Cómo subir FarmaConnect a Render (paso a paso)

Tu proyecto ya está preparado para producción. Sigue estos pasos.

## Paso 1: Crear cuenta en GitHub (si no tienes)
1. Entra a https://github.com y crea una cuenta gratis.

## Paso 2: Subir el proyecto a GitHub
Tienes dos opciones:

**Opción fácil (web):**
1. En GitHub, haz clic en "New repository" (nuevo repositorio).
2. Ponle un nombre, por ejemplo `farmaconnect`. Déjalo como **Public**.
3. Crea el repositorio.
4. Haz clic en "uploading an existing file" y arrastra TODOS los archivos de esta carpeta
   (app.py, index.html, script.js, style.css, init_db.py, Dockerfile, requirements.txt,
   render.yaml, .dockerignore, .gitignore).
5. Haz clic en "Commit changes".

**Opción con consola (si tienes Git):**
```
git init
git add .
git commit -m "FarmaConnect listo para Render"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/farmaconnect.git
git push -u origin main
```

## Paso 3: Crear cuenta en Render
1. Entra a https://render.com
2. Regístrate gratis (puedes usar tu cuenta de GitHub).

## Paso 4: Crear el servicio web
1. En el panel de Render, haz clic en "New +" → "Web Service".
2. Conecta tu cuenta de GitHub y selecciona el repositorio `farmaconnect`.
3. Render detectará el Dockerfile automáticamente.
4. Configura:
   - **Name:** farmaconnect (o el que quieras)
   - **Region:** la más cercana
   - **Instance Type:** Free
5. Antes de crear, ve a "Advanced" y agrega estas variables de entorno
   (Environment Variables):

   | Key | Value |
   |-----|-------|
   | RENDER | true |
   | GROQ_API_KEY | (tu clave de Groq, la que empieza con gsk_) |
   | ADMIN_EMAIL | admin@farmaconnect.cl |
   | ADMIN_PASSWORD | (elige una contraseña de admin) |

6. Haz clic en "Create Web Service".

## Paso 5: Esperar el despliegue
- Render construirá la imagen (instala Chrome, esto tarda ~5-10 minutos la primera vez).
- Cuando termine, verás "Live" y una URL como `https://farmaconnect.onrender.com`.
- ¡Esa es tu página pública! Compártela.

## Notas importantes
- **Plan gratis:** el servicio "se duerme" tras 15 min sin uso. La primera visita después
  de dormir tarda ~30-50 segundos en despertar. Es normal en el plan gratuito.
- **Login admin:** entra con el ADMIN_EMAIL y ADMIN_PASSWORD que configuraste.
- **Velocidad del scraping:** en el plan gratis puede ir un poco más lento que en tu PC,
  porque el servidor tiene menos recursos. Si va muy lento, considera el plan pagado.
- **Base de datos:** en el plan gratis, si Render reinicia el servicio, los usuarios nuevos
  y reportes podrían borrarse. El admin se vuelve a crear solo. Para datos permanentes
  necesitarías agregar un disco persistente (plan pagado) o una base de datos externa.

## Tu clave de Groq
Tu clave actual está en el código como respaldo, pero por seguridad es mejor ponerla
solo como variable de entorno en Render y, si el repositorio es público, generar una
clave nueva en https://console.groq.com (la actual quedó visible en el historial).
