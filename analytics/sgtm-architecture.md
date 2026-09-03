# Arquitectura Analítica Server-Side (sGTM + Meta CAPI + Pinterest CAPI)
## Plataforma Estratégica: Miyuki Pro (Fase 1 - Captación y Cualificación)

### 1. Resumen Ejecutivo de Infraestructura
En el comercio digital de alto valor y captación B2B/B2C cualificada, depender exclusivamente de píxeles del lado del cliente (Client-Side) implica una pérdida de entre el 20% y el 35% de los datos debido a:
- Bloqueadores de anuncios (AdBlock, Brave, uBlock Origin).
- Restricciones de privacidad en iOS/macOS (Apple ITP y ATT).
- Descarte de cookies de terceros en navegadores modernos.

Para blindar la atribución y optimizar el Coste de Adquisición de Clientes (CAC) de cara al lanzamiento del catálogo completo en Fase 2, se implementa una **arquitectura híbrida con deduplicación server-side**.

---

### 2. Diagrama de Flujo de Datos Híbrido y Deduplicación

```
[ Navegador del Usuario ]
       │
       ├── (1) Evento Client-Side + event_id ───► [ Meta Pixel / Pinterest Tag ]
       │                                                      │
       └── (2) dataLayer.push({ event_id, ... })              │
                   │                                          │
                   ▼                                          │
       [ sGTM Web Container ]                                 │
                   │ (HTTP POST en primer dominio)            │
                   ▼                                          ▼
   [ sGTM Server Container (data.miyukipro.com) ]   [ Algoritmo de Deduplicación ]
                   │                                (Coincidencia por event_id)
                   ├─── (3) Meta Conversions API ─────────────┘
                   │
                   └─── (4) Pinterest Conversions API
```

---

### 3. Mecanismo de Deduplicación por `event_id`
Para evitar el doble conteo de conversiones cuando tanto el navegador como el servidor informan del mismo evento:
1. **Generación Única en Cliente**: Al ocurrir la interacción (ej. envío del formulario del lead magnet), `js/main.js` invoca `generateEventId('lead_download')`, produciendo un identificador UUID + timestamp:
   `lead_download_4f9a7b21-819a-4c22-9214-998811223344_1741038125000`
2. **Emisión Simultánea**:
   - **Lado del Navegador**: El píxel de Meta recibe `fbq('track', 'Lead', { ... }, { eventID: event_id })`.
   - **Lado del Servidor**: El objeto `dataLayer.push` transmite el mismo `event_id` al contenedor web de GTM, que a su vez lo envía a través de un cliente GA4 o Data Client hacia el contenedor Server-Side de GTM.
3. **Deduplicación Automática en Plataforma**:
   - Meta compara las marcas de tiempo y el `event_id`. Si ambos llegan en una ventana de 48 horas, contabiliza una sola conversión oficial, pero utiliza los parámetros del servidor (IP real, User Agent y datos cifrados) para maximizar el **Event Match Quality (EMQ > 8.0)**.

---

### 4. Estructura de Payloads y Normalización Criptográfica (SHA-256)

#### A. Evento: `lead_guide_download` (Equivalente a Lead / CompleteRegistration)
```json
{
  "event_name": "Lead",
  "event_id": "lead_download_9a3c4e12-88ef-4122-83bb-112233445566_1741038125000",
  "event_time": 1741038125,
  "action_source": "website",
  "event_source_url": "https://miyukipro.com/#lead-magnet",
  "user_data": {
    "em": "5f4dcc3b5aa765d61d8327deb882cf992b96e6d76de84d193d9b4b0e50efdf70", // SHA-256 de "usuario@dominio.com"
    "fn": "b1b11b518291cdcb9922e4c8f3e58e0a12e3e67e3a9a149c4cf4de78f89e27c6", // SHA-256 de "Valeria"
    "client_ip_address": "185.122.45.10",
    "client_user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "fbc": "fb.1.1741038120.IwAR2...",
    "fbp": "fb.1.1741038120.123456789"
  },
  "custom_data": {
    "content_name": "Guia_Equivalencias_Pantone_Miyuki_2026",
    "craft_technique": "peyote_brick",
    "currency": "EUR",
    "value": 15.00
  }
}
```

#### B. Evento: `b2b_calendly_engaged` (Equivalente a Schedule / High-Ticket Lead)
```json
{
  "event_name": "Schedule",
  "event_id": "calendly_opened_7b4c2d11-44aa-4921-b3cc-556677889900_1741038190000",
  "event_time": 1741038190,
  "action_source": "website",
  "user_data": {
    "client_ip_address": "185.122.45.10",
    "client_user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "fbp": "fb.1.1741038120.123456789"
  },
  "custom_data": {
    "content_category": "B2B Wholesale Consultation",
    "currency": "EUR",
    "value": 250.00
  }
}
```

---

### 5. Configuración del Servidor y CDN (Subdominio de Primer Nivel)
1. **Subdominio Dedicado**: Configurar `data.miyukipro.com` apuntando mediante CNAME a la instancia de sGTM (Google Cloud Run o clúster de Stape.io).
2. **Ventajas Técnicas**:
   - **First-Party Context**: Las cookies de identificación (`_fbp`, `_fbc`, `_ga`) se emiten bajo el dominio raíz `.miyukipro.com`, esquivando los bloqueos por origen de terceros y extendiendo su persistencia a más de 7 días en Safari.
   - **Ocultamiento de Redirecciones**: Los scripts de etiquetado se descargan desde `data.miyukipro.com/gtm.js?id=GTM-XXXX`, lo que previene el filtrado de listas públicas de EasyList / uBlock.
   - **Reducción de Latencia**: Distribución mediante Cloudflare Edge con compresión Brotli y TLS 1.3 con 0-RTT.
