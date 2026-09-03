/**
 * ============================================================================
 * MIYUKI ATELIER - MÓDULO SUPABASE (BASE DE DATOS & STORAGE EN LA NUBE)
 * Conexión directa a PostgreSQL y Bucket de Fotos 24/7 sin servidor propio
 * ============================================================================
 */

(function () {
  'use strict';

  // Configuración oficial de Supabase para Miyuki Atelier
  var SUPABASE_DEFAULTS = {
    url: 'https://cruokfrmiabqjuectaof.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydW9rZnJtaWFicWp1ZWN0YW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjY2OTgsImV4cCI6MjEwNDA0MjY5OH0.DowiEv9OdS7SbMoU6KEIyAxkfDURbODuBkKZP_O2Vq4'
  };

  function getSupabaseConfig() {
    var storedUrl = localStorage.getItem('atelier_supabase_url');
    var storedKey = localStorage.getItem('atelier_supabase_anon_key');

    var rawUrl = storedUrl || SUPABASE_DEFAULTS.url;
    var cleanUrl = rawUrl ? rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '') : '';

    return {
      url: cleanUrl,
      anonKey: storedKey || SUPABASE_DEFAULTS.anonKey
    };
  }

  function getClient() {
    var config = getSupabaseConfig();
    if (!config.url || !config.anonKey) return null;
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') return null;

    if (!window._supabaseClientInstance || window._supabaseCurrentUrl !== config.url) {
      window._supabaseClientInstance = window.supabase.createClient(config.url, config.anonKey.trim());
      window._supabaseCurrentUrl = config.url;
    }
    return window._supabaseClientInstance;
  }

  window.AtelierSupabase = {
    isConfigured: function () {
      var client = getClient();
      return client !== null;
    },

    saveConfig: function (url, key) {
      var cleanUrl = url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
      localStorage.setItem('atelier_supabase_url', cleanUrl);
      localStorage.setItem('atelier_supabase_anon_key', key.trim());
      window._supabaseClientInstance = null; // Reiniciar cliente
    },

    getConfig: getSupabaseConfig,

    // Obtener todos los productos desde la tabla 'products'
    fetchProducts: async function () {
      var client = getClient();
      if (!client) return null;

      try {
        var res = await client
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (res.error) throw res.error;

        // Normalizar estructura compatible con nuestro frontend
        return res.data.map(function (row) {
          return {
            id: row.id,
            title: row.title,
            price: parseFloat(row.price),
            inStock: Boolean(row.in_stock),
            category: row.category || 'pulseras',
            badge: row.badge || 'HECHO A MANO',
            shortDesc: row.short_desc || '',
            desc: row.desc || '',
            photos: Array.isArray(row.photos) ? row.photos : []
          };
        });
      } catch (err) {
        console.error('[Supabase Error] al obtener productos:', err);
        return null;
      }
    },

    // Subir foto a Supabase Storage y obtener URL pública permanente
    uploadPhoto: async function (base64Data, filename) {
      var client = getClient();
      if (!client) return null;

      try {
        // Convertir base64 a Blob
        var parts = base64Data.split(';base64,');
        var contentType = parts[0].replace('data:', '');
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;
        var uInt8Array = new Uint8Array(rawLength);
        for (var i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        var blob = new Blob([uInt8Array], { type: contentType });

        var filePath = 'joyas/' + filename;
        var uploadRes = await client.storage
          .from('product-photos')
          .upload(filePath, blob, {
            contentType: contentType,
            upsert: true
          });

        if (uploadRes.error) throw uploadRes.error;

        // Obtener URL pública
        var publicUrlRes = client.storage
          .from('product-photos')
          .getPublicUrl(filePath);

        return publicUrlRes.data.publicUrl;
      } catch (err) {
        console.error('[Supabase Storage Error] al subir foto:', err);
        return null;
      }
    },

    // Crear nuevo producto en Supabase
    createProduct: async function (productData, base64Photos) {
      var client = getClient();
      if (!client) return null;

      var timestamp = Date.now();
      var uploadedPhotoUrls = [];

      // Subir fotos a Supabase Storage
      for (var i = 0; i < base64Photos.length; i++) {
        var photoItem = base64Photos[i];
        if (photoItem.startsWith('data:image')) {
          var filename = 'joya_' + timestamp + '_' + (i + 1) + '.jpg';
          var publicUrl = await this.uploadPhoto(photoItem, filename);
          if (publicUrl) uploadedPhotoUrls.push(publicUrl);
        } else if (photoItem.startsWith('http') || photoItem.startsWith('assets/')) {
          uploadedPhotoUrls.push(photoItem);
        }
      }

      if (uploadedPhotoUrls.length === 0) {
        uploadedPhotoUrls.push('assets/products/pulsera-rombo-oro-natural.jpg');
      }

      var newRecord = {
        id: 'prod_' + timestamp,
        title: productData.title,
        price: parseFloat(productData.price),
        in_stock: Boolean(productData.inStock),
        category: productData.category || 'pulseras',
        badge: productData.badge || 'NUEVA CREACIÓN',
        short_desc: productData.desc ? productData.desc.substring(0, 85) + (productData.desc.length > 85 ? '...' : '') : '',
        desc: productData.desc || '',
        photos: uploadedPhotoUrls
      };

      var insertRes = await client
        .from('products')
        .insert([newRecord])
        .select();

      if (insertRes.error) throw insertRes.error;

      return {
        id: newRecord.id,
        title: newRecord.title,
        price: newRecord.price,
        inStock: newRecord.in_stock,
        category: newRecord.category,
        badge: newRecord.badge,
        shortDesc: newRecord.short_desc,
        desc: newRecord.desc,
        photos: newRecord.photos
      };
    },

    // Alternar stock en Supabase
    toggleStock: async function (productId, currentStatus) {
      var client = getClient();
      if (!client) return false;

      var updateRes = await client
        .from('products')
        .update({ in_stock: !currentStatus })
        .eq('id', productId);

      return !updateRes.error;
    },

    // Eliminar producto en Supabase
    deleteProduct: async function (productId) {
      var client = getClient();
      if (!client) return false;

      var deleteRes = await client
        .from('products')
        .delete()
        .eq('id', productId);

      return !deleteRes.error;
    }
  };

})();
