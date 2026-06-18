FROM python:3.11-slim

# Instalar Google Chrome y dependencias necesarias para Selenium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome estable
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Instalar el chromedriver que coincide con la versión de Chrome instalada
RUN CHROME_VERSION=$(google-chrome --version | grep -oP '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+') \
    && echo "Chrome version: $CHROME_VERSION" \
    && wget -q "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chromedriver-linux64.zip" -O /tmp/chromedriver.zip \
    && unzip /tmp/chromedriver.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver \
    && chmod +x /usr/local/bin/chromedriver \
    && rm -rf /tmp/chromedriver.zip /tmp/chromedriver-linux64

WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del proyecto
COPY . .

# Inicializar la base de datos si no existe
# La base de datos se inicializa al ARRANCAR (no al construir),
# porque el disco persistente se monta recién al ejecutar el contenedor.

# Render asigna el puerto por la variable PORT
ENV PORT=10000
EXPOSE 10000

# Arrancar: primero inicializa la BD (si no existe), luego lanza el servidor
CMD python init_db.py; gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 180 --max-requests 50 --max-requests-jitter 10 app:app
