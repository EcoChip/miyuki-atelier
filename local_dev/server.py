import http.server
import socketserver
import json
import os
import base64
import time
import re

PORT = int(os.environ.get("PORT", 8000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIRECTORY, "data", "products.json")
UPLOAD_DIR = os.path.join(DIRECTORY, "assets", "products")

os.makedirs(os.path.join(DIRECTORY, "data"), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

class AtelierHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(body)

    def read_products(self):
        if not os.path.exists(DATA_FILE):
            return []
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print("Error leyendo JSON:", e)
            return []

    def write_products(self, products):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)

    def do_GET(self):
        if self.path == '/api/products' or self.path.startswith('/api/products?'):
            products = self.read_products()
            self.send_json(products, 200)
            return

        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"

        if self.path == '/api/products':
            try:
                data = json.loads(post_data)
                products = self.read_products()

                timestamp = int(time.time() * 1000)
                product_id = data.get('id') or f"prod_{timestamp}"

                raw_photos = data.get('photos', [])
                saved_photos = []

                for idx, item in enumerate(raw_photos):
                    if item.startswith('data:image'):
                        match = re.match(r"data:image/(\w+);base64,(.+)", item)
                        if match:
                            ext = match.group(1).lower()
                            if ext == 'jpeg': ext = 'jpg'
                            b64_str = match.group(2)
                            img_data = base64.b64decode(b64_str)

                            filename = f"joya_{timestamp}_{idx+1}.{ext}"
                            filepath = os.path.join(UPLOAD_DIR, filename)
                            with open(filepath, 'wb') as img_file:
                                img_file.write(img_data)

                            saved_photos.append(f"assets/products/{filename}")
                    elif item.strip():
                        saved_photos.append(item.strip())

                if not saved_photos:
                    saved_photos.append("assets/products/pulsera-rombo-oro-natural.jpg")

                new_product = {
                    "id": product_id,
                    "title": data.get('title', 'Joya Artesanal'),
                    "price": float(data.get('price', 28.0)),
                    "inStock": bool(data.get('inStock', True)),
                    "category": data.get('category', 'pulseras'),
                    "badge": data.get('badge', 'NUEVA CREACIÓN'),
                    "shortDesc": data.get('desc', '')[:85] + ('...' if len(data.get('desc', '')) > 85 else ''),
                    "desc": data.get('desc', ''),
                    "photos": saved_photos
                }

                products.insert(0, new_product)
                self.write_products(products)
                self.send_json({"success": True, "product": new_product}, 201)
                return

            except Exception as e:
                print("Error creando producto:", e)
                self.send_json({"error": str(e)}, 500)
                return

        elif self.path == '/api/products/toggle-stock':
            try:
                data = json.loads(post_data)
                prod_id = data.get('id')
                products = self.read_products()
                new_stock = True
                for p in products:
                    if p["id"] == prod_id:
                        p["inStock"] = not p.get("inStock", True)
                        new_stock = p["inStock"]
                        break
                self.write_products(products)
                self.send_json({"success": True, "inStock": new_stock}, 200)
                return
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
                return

        elif self.path == '/api/products/delete':
            try:
                data = json.loads(post_data)
                prod_id = data.get('id')
                products = self.read_products()
                products = [p for p in products if p["id"] != prod_id]
                self.write_products(products)
                self.send_json({"success": True}, 200)
                return
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
                return

        self.send_json({"error": "Ruta no encontrada"}, 404)

# Compatibilidad con Vercel Serverless
handler = AtelierHandler
app = AtelierHandler

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    print(f"Servidor Miyuki Atelier activo en http://localhost:{PORT}")
    print(f"Base de datos: {DATA_FILE}")
    print(f"Carpeta de fotos: {UPLOAD_DIR}")
    with socketserver.TCPServer(("", PORT), AtelierHandler) as httpd:
        httpd.serve_forever()
