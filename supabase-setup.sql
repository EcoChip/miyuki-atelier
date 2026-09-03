-- ============================================================================
-- MIYUKI ATELIER - CONFIGURACIÓN DE BASE DE DATOS Y STORAGE EN SUPABASE (RE-EJECUTABLE)
-- Copia y pega TODO este código en el SQL Editor de supabase.com y pulsa "Run"
-- ============================================================================

-- 1. Crear la tabla de productos si no existe
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 28.00,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'pulseras',
  badge TEXT DEFAULT 'HECHO A MANO',
  short_desc TEXT,
  "desc" TEXT,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar seguridad de nivel de fila (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas para evitar error 42710 si se ejecuta más de una vez
DROP POLICY IF EXISTS "Lectura pública de productos" ON public.products;
DROP POLICY IF EXISTS "Gestión completa de productos" ON public.products;

-- Crear políticas limpias
CREATE POLICY "Lectura pública de productos"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Gestión completa de productos"
ON public.products FOR ALL
USING (true);

-- 3. Crear Bucket de Fotos 'product-photos' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Eliminar políticas previas en storage para evitar duplicados
DROP POLICY IF EXISTS "Fotos públicas visibles por todos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subir fotos desde el panel" ON storage.objects;
DROP POLICY IF EXISTS "Permitir borrar fotos" ON storage.objects;

-- Crear políticas de Storage
CREATE POLICY "Fotos públicas visibles por todos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

CREATE POLICY "Permitir subir fotos desde el panel"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "Permitir borrar fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos');

-- 4. Insertar la Pulsera 'Arena, Rombo & Oro' si aún no está
INSERT INTO public.products (id, title, price, in_stock, category, badge, short_desc, "desc", photos)
VALUES (
  'pulsera-rombo-oro',
  'Pulsera ''Arena, Rombo & Oro''',
  28.00,
  true,
  'pulseras',
  'DISEÑO ORIGINAL DE TALLER',
  'Fondo blanco marfil satinado con rombos geométricos en oro brillante. Cordón corredizo beige ajustable.',
  'Tejida a mano con auténtico cristal japonés Miyuki Delica. Los rombos geométricos en tono oro capturan la luz con un brillo sutil y sofisticado. El cierre con cordón corredizo y bolitas doradas se adapta a cualquier tamaño de muñeca. Incluye presentación sobre rodaja de madera, tarjeta botánica y bolsita de lino lista para regalar.',
  ARRAY[
    'assets/products/pulsera-rombo-oro-natural.jpg',
    'assets/products/pulsera-rombo-oro-pack.jpg',
    'assets/products/pulsera-rombo-oro-muneca-1.jpg',
    'assets/products/pulsera-rombo-oro-muneca-2.jpg'
  ]
)
ON CONFLICT (id) DO NOTHING;
