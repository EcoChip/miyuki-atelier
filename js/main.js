/**
 * ============================================================================
 * MIYUKI ATELIER - SISTEMA INTEGRAL BOUTIQUE & GESTIÓN DE ANUNCIOS
 * Base de Datos en Disco (data/products.json), Guardado de Fotos en Servidor,
 * Compresión de Imágenes en Canvas, Panel Anti-Fuerza Bruta y WhatsApp
 * ============================================================================
 */

(function () {
  'use strict';

  var ATELIER_CONFIG = {
    whatsappNumber: '34629365884',
    shippingPrice: 3.95,
    freeShippingThreshold: 45.00,
    salt: 'miyuki_salt_secure_',
    defaultMasterHash: 'b7197a251604bc34e3fb2ac3596f6cad62e424f3c52e04e1a3e31ed3bf9c40e0' // "TallerMiyuki2026!"
  };

  // Variable de estado en memoria
  var currentProducts = [];
  var selectedNewPhotos = []; // Fotos listas para enviar en nuevo anuncio

  // --------------------------------------------------------------------------
  // 1. CARGA DE BASE DE DATOS (SUPABASE CLOUD 24/7 + SERVER LOCAL + LOCALSTORAGE)
  // --------------------------------------------------------------------------
  async function fetchProductsFromDatabase() {
    // 1. Prioridad: Si Supabase está configurado, cargar directamente de la nube 24/7
    if (window.AtelierSupabase && window.AtelierSupabase.isConfigured()) {
      try {
        var supabaseData = await window.AtelierSupabase.fetchProducts();
        if (Array.isArray(supabaseData) && supabaseData.length > 0) {
          currentProducts = supabaseData;
          localStorage.setItem('miyuki_products_db', JSON.stringify(supabaseData));
          renderCatalogGrid();
          return;
        }
      } catch (sbErr) {
        console.warn('Error cargando desde Supabase:', sbErr);
      }
    }

    // 2. Servidor local si está en desarrollo
    try {
      var res = await fetch('/api/products');
      if (res.ok) {
        var data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          currentProducts = data;
          localStorage.setItem('miyuki_products_db', JSON.stringify(data));
          renderCatalogGrid();
          return;
        }
      }
    } catch (err) {
      console.warn('API del servidor no disponible, usando base de datos local:', err);
    }

    // 3. Fallback a almacenamiento local
    try {
      var saved = localStorage.getItem('miyuki_products_db');
      if (saved) {
        currentProducts = JSON.parse(saved);
        renderCatalogGrid();
        return;
      }
    } catch (e) {}

    currentProducts = [];
    renderCatalogGrid();
  }

  function getProducts() {
    return currentProducts;
  }

  // --------------------------------------------------------------------------
  // 2. RENDERIZADO DE LA CUADRÍCULA DE PRODUCTOS
  // --------------------------------------------------------------------------
  function renderCatalogGrid() {
    var grid = document.querySelector('.products-grid');
    if (!grid) return;

    var products = getProducts();
    if (products.length === 0) {
      grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding:2rem; color:#888;">Cargando colección...</p>';
      return;
    }

    var html = '';
    products.forEach(function (prod) {
      var mainPhoto = (prod.photos && prod.photos.length > 0) ? prod.photos[0] : 'assets/products/pulsera-rombo-oro-natural.jpg';
      var stockBadge = prod.inStock 
        ? `<span class="product-pill">${prod.badge || 'HECHO A MANO'}</span>`
        : `<span class="product-pill" style="background:#FDF2E9; color:#D9534F;">AGOTADO / BAJO ENCARGO</span>`;

      var buttonText = prod.inStock ? 'Añadir a la bolsita' : 'Encargar por WhatsApp';

      html += `
        <article class="product-card" data-product-id="${prod.id}" data-category="${prod.category || 'pulseras'}">
          <div class="product-media" onclick="window.openProductDetailModal('${prod.id}')" style="cursor:pointer;">
            <img src="${mainPhoto}" alt="${prod.title}" loading="lazy">
            ${stockBadge}
          </div>
          <div class="product-body">
            <h2 class="product-title" onclick="window.openProductDetailModal('${prod.id}')" style="cursor:pointer;">${prod.title}</h2>
            <p class="product-short-desc">${prod.shortDesc || prod.desc || ''}</p>
            <div class="product-footer">
              <span class="product-price">${parseFloat(prod.price).toFixed(2)} €</span>
              <button type="button" class="btn btn-primary btn-sm btn-add-cart" data-id="${prod.id}">
                ${buttonText}
              </button>
            </div>
          </div>
        </article>
      `;
    });

    grid.innerHTML = html;
    initProductButtons();
  }

  // --------------------------------------------------------------------------
  // 3. MODAL DE DETALLE DE PRODUCTO GRANDE (QUICK VIEW)
  // --------------------------------------------------------------------------
  window.openProductDetailModal = function (productId) {
    var products = getProducts();
    var prod = products.find(function (p) { return p.id === productId; });
    if (!prod) return;

    var modal = document.getElementById('product-detail-modal');
    if (!modal) return;

    document.getElementById('modal-detail-title').textContent = prod.title;
    document.getElementById('modal-detail-price').textContent = parseFloat(prod.price).toFixed(2) + ' €';
    document.getElementById('modal-detail-desc').textContent = prod.desc || prod.shortDesc;
    document.getElementById('modal-detail-badge').textContent = prod.badge || 'JOYA ARTESANAL';

    var stockEl = document.getElementById('modal-detail-stock');
    if (stockEl) {
      if (prod.inStock) {
        stockEl.className = 'badge-stock badge-in-stock';
        stockEl.textContent = 'En Stock • Envío en 24/48h';
      } else {
        stockEl.className = 'badge-stock badge-out-of-stock';
        stockEl.textContent = 'Bajo Encargo (Tejido en 3-5 días)';
      }
    }

    var mainImg = document.getElementById('modal-detail-main-img');
    var thumbsRow = document.getElementById('modal-detail-thumbs');
    var photos = (prod.photos && prod.photos.length > 0) ? prod.photos : ['assets/products/pulsera-rombo-oro-natural.jpg'];

    mainImg.src = photos[0];
    thumbsRow.innerHTML = '';

    if (photos.length > 1) {
      photos.forEach(function (photoUrl, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-modal-thumb-btn' + (idx === 0 ? ' active' : '');
        btn.innerHTML = `<img src="${photoUrl}" alt="Foto ${idx + 1}">`;
        btn.onclick = function () {
          mainImg.src = photoUrl;
          thumbsRow.querySelectorAll('.product-modal-thumb-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        };
        thumbsRow.appendChild(btn);
      });
      thumbsRow.style.display = 'flex';
    } else {
      thumbsRow.style.display = 'none';
    }

    var btnAddCart = document.getElementById('modal-btn-add-cart');
    if (btnAddCart) {
      btnAddCart.onclick = function () {
        addToCart({
          id: prod.id,
          title: prod.title,
          price: prod.price,
          image: photos[0]
        });
        closeProductDetailModal();
      };
    }

    var btnDirectWA = document.getElementById('modal-btn-whatsapp');
    if (btnDirectWA) {
      btnDirectWA.onclick = function () {
        var msg = encodeURIComponent(`✨ ¡Hola! He visto en la web la joya '${prod.title}' (${parseFloat(prod.price).toFixed(2)} €) y me gustaría pedirla. ¿Tenéis disponible? Muchas gracias :)`);
        window.open(`https://wa.me/${ATELIER_CONFIG.whatsappNumber}?text=${msg}`, '_blank');
      };
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  function closeProductDetailModal() {
    var modal = document.getElementById('product-detail-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  // --------------------------------------------------------------------------
  // 4. CARRITO BOUTIQUE
  // --------------------------------------------------------------------------
  var cart = [];

  function loadCart() {
    try {
      var saved = localStorage.getItem('miyuki_cart');
      if (saved) cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
    updateCartUI();
  }

  function saveCart() {
    try {
      localStorage.setItem('miyuki_cart', JSON.stringify(cart));
    } catch (e) {}
    updateCartUI();
  }

  function addToCart(product) {
    var existing = cart.find(function (item) { return item.id === product.id; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: parseFloat(product.price),
        image: product.image,
        qty: 1
      });
    }
    saveCart();
    openCartDrawer();
  }

  function removeFromCart(productId) {
    cart = cart.filter(function (item) { return item.id !== productId; });
    saveCart();
  }

  function calculateSubtotal() {
    return cart.reduce(function (sum, item) { return sum + (item.price * item.qty); }, 0);
  }

  function updateCartUI() {
    var countBadges = document.querySelectorAll('.cart-count');
    var totalQty = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
    countBadges.forEach(function (badge) { badge.textContent = totalQty; });

    var itemsContainer = document.getElementById('cart-drawer-items');
    var subtotalEl = document.getElementById('cart-subtotal-price');
    var btnCheckoutWhatsApp = document.getElementById('btn-checkout-whatsapp');

    if (!itemsContainer) return;

    if (cart.length === 0) {
      itemsContainer.innerHTML = '<div class="cart-empty-state"><p>Tu bolsita de joyas está vacía.</p><p style="font-size:0.8rem; margin-top:0.5rem; color:#888;">Elige una pieza hecha a mano para empezar.</p></div>';
      if (subtotalEl) subtotalEl.textContent = '0.00 €';
      if (btnCheckoutWhatsApp) btnCheckoutWhatsApp.style.display = 'none';
      return;
    }

    var html = '';
    cart.forEach(function (item) {
      html += `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.title}" class="cart-item-img">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.title}</h4>
            <span class="cart-item-price">${(item.price * item.qty).toFixed(2)} € (${item.qty} ud.)</span>
          </div>
          <button type="button" class="btn-remove-item" data-id="${item.id}">Quitar</button>
        </div>
      `;
    });
    itemsContainer.innerHTML = html;

    var subtotal = calculateSubtotal();
    if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + ' €';
    if (btnCheckoutWhatsApp) {
      btnCheckoutWhatsApp.style.display = 'flex';
      btnCheckoutWhatsApp.onclick = handleWhatsAppCheckout;
    }

    itemsContainer.querySelectorAll('.btn-remove-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeFromCart(btn.getAttribute('data-id'));
      });
    });
  }

  function handleWhatsAppCheckout() {
    if (cart.length === 0) return;
    var subtotal = calculateSubtotal();
    var text = '✨ ¡Hola! He visto vuestras joyas en Instagram y me gustaría hacer este pedido hecho a mano:\n\n';

    cart.forEach(function (item) {
      text += `• ${item.qty}x ${item.title} (${item.price.toFixed(2)} €)\n`;
    });

    text += `\n📦 Total de las piezas: ${subtotal.toFixed(2)} €`;
    text += `\n¿Tenéis disponible para preparar con la cajita de regalo? Muchas gracias :)`;

    var encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${ATELIER_CONFIG.whatsappNumber}?text=${encoded}`, '_blank');
  }

  // --------------------------------------------------------------------------
  // 5. APERTURA Y CIERRE DEL CARRITO DRAWER
  // --------------------------------------------------------------------------
  var cartOverlay = document.getElementById('cart-drawer-overlay');

  function openCartDrawer() {
    if (cartOverlay) cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCartDrawer() {
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  function initCartDrawer() {
    document.querySelectorAll('.cart-trigger-btn').forEach(function (btn) {
      btn.addEventListener('click', openCartDrawer);
    });

    var closeBtn = document.getElementById('btn-close-cart');
    if (closeBtn) closeBtn.addEventListener('click', closeCartDrawer);

    if (cartOverlay) {
      cartOverlay.addEventListener('click', function (e) {
        if (e.target === cartOverlay) closeCartDrawer();
      });
    }
  }

  function initProductButtons() {
    document.querySelectorAll('.btn-add-cart').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var prodId = btn.getAttribute('data-id');
        var products = getProducts();
        var prod = products.find(function (p) { return p.id === prodId; });
        if (prod) {
          if (!prod.inStock) {
            var msg = encodeURIComponent(`Hola! Me interesa encargar la pieza '${prod.title}'. ¿En cuántos días podríais tenerla lista?`);
            window.open(`https://wa.me/${ATELIER_CONFIG.whatsappNumber}?text=${msg}`, '_blank');
            return;
          }

          var photo = (prod.photos && prod.photos.length > 0) ? prod.photos[0] : '';
          addToCart({
            id: prod.id,
            title: prod.title,
            price: prod.price,
            image: photo
          });
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 6. COMPRESIÓN Y REDIMENSIONADO DE IMÁGENES EN EL NAVEGADOR (CANVAS)
  // --------------------------------------------------------------------------
  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var maxDim = 1200;
          var width = img.width;
          var height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compresión a JPEG al 82% (calidad visual idéntica, peso <150KB)
          var compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPhotoPreviews() {
    var strip = document.getElementById('new-prod-preview-strip');
    if (!strip) return;

    strip.innerHTML = '';
    selectedNewPhotos.forEach(function (src, idx) {
      var item = document.createElement('div');
      item.style.position = 'relative';
      item.style.width = '70px';
      item.style.height = '70px';
      item.style.borderRadius = '6px';
      item.style.overflow = 'hidden';
      item.style.border = '1px solid #ddd';

      item.innerHTML = `
        <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
        <button type="button" data-idx="${idx}" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
      `;

      item.querySelector('button').onclick = function () {
        selectedNewPhotos.splice(idx, 1);
        renderPhotoPreviews();
      };

      strip.appendChild(item);
    });
  }

  // --------------------------------------------------------------------------
  // 7. PANEL PRIVADO DEL TALLER (SEGURIDAD & PUBLICACIÓN DE ANUNCIOS)
  // --------------------------------------------------------------------------
  async function computeHash(password) {
    var msgBuffer = new TextEncoder().encode(ATELIER_CONFIG.salt + password);
    var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function checkLockout() {
    var lockoutUntil = parseInt(localStorage.getItem('admin_lockout_until') || '0', 10);
    var now = Date.now();
    if (lockoutUntil && lockoutUntil > now) {
      return Math.ceil((lockoutUntil - now) / 1000);
    }
    return 0;
  }

  function setLockout() {
    localStorage.setItem('admin_lockout_until', Date.now() + 30000);
    localStorage.setItem('admin_failed_attempts', '0');
  }

  function initAdminPanel() {
    var openBtn = document.getElementById('btn-open-admin-access');
    var loginModal = document.getElementById('admin-login-modal');
    var dashModal = document.getElementById('admin-dashboard-modal');
    var loginForm = document.getElementById('admin-login-form');
    var pwdInput = document.getElementById('admin-password-input');
    var lockoutMsg = document.getElementById('admin-lockout-msg');
    var btnSubmit = document.getElementById('btn-submit-admin-login');

    if (!openBtn) return;

    openBtn.addEventListener('click', function () {
      if (sessionStorage.getItem('atelier_admin_logged') === 'true') {
        openDashboard();
      } else {
        openLoginModal();
      }
    });

    function openLoginModal() {
      if (loginModal) {
        loginModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        verifyLockoutStatus();
        if (pwdInput) { pwdInput.value = ''; pwdInput.focus(); }
      }
    }

    function closeLoginModal() {
      if (loginModal) loginModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }

    function openDashboard() {
      closeLoginModal();
      if (dashModal) {
        dashModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderAdminProductsList();
      }
    }

    function closeDashboard() {
      if (dashModal) dashModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }

    function verifyLockoutStatus() {
      var remaining = checkLockout();
      if (remaining > 0) {
        if (btnSubmit) btnSubmit.disabled = true;
        if (lockoutMsg) {
          lockoutMsg.style.display = 'block';
          lockoutMsg.textContent = `⚠️ Demasiados intentos fallidos. Bloqueado durante ${remaining} segundos por seguridad.`;
        }
        setTimeout(verifyLockoutStatus, 1000);
      } else {
        if (btnSubmit) btnSubmit.disabled = false;
        if (lockoutMsg) lockoutMsg.style.display = 'none';
      }
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        var remaining = checkLockout();
        if (remaining > 0) {
          verifyLockoutStatus();
          return;
        }

        var inputPwd = pwdInput.value.trim();
        var hashedInput = await computeHash(inputPwd);
        var currentMasterHash = localStorage.getItem('admin_custom_hash') || ATELIER_CONFIG.defaultMasterHash;

        if (hashedInput === currentMasterHash) {
          localStorage.setItem('admin_failed_attempts', '0');
          sessionStorage.setItem('atelier_admin_logged', 'true');
          openDashboard();
        } else {
          var attempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0', 10) + 1;
          localStorage.setItem('admin_failed_attempts', attempts.toString());

          if (attempts >= 5) {
            setLockout();
            verifyLockoutStatus();
          } else {
            alert(`Contraseña incorrecta. Intentos restantes antes del bloqueo: ${5 - attempts}`);
          }
        }
      });
    }

    document.querySelectorAll('.btn-close-admin').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeLoginModal();
        closeDashboard();
      });
    });

    var btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        sessionStorage.removeItem('atelier_admin_logged');
        closeDashboard();
        alert('Sesión cerrada correctamente.');
      });
    }

    document.querySelectorAll('.admin-tab-btn').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab-btn').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-content').forEach(function (c) { c.style.display = 'none'; });

        tab.classList.add('active');
        var targetId = tab.getAttribute('data-tab');
        var targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.style.display = 'block';
      });
    });

    // Manejo de Fotos Múltiples con Compresión Automática
    var fileInput = document.getElementById('new-prod-img-file');
    if (fileInput) {
      fileInput.addEventListener('change', async function () {
        var files = Array.from(fileInput.files);
        if (!files.length) return;

        for (var i = 0; i < files.length; i++) {
          try {
            var compressed = await compressImageFile(files[i]);
            selectedNewPhotos.push(compressed);
          } catch (err) {
            console.error('Error optimizando foto:', err);
          }
        }
        renderPhotoPreviews();
        fileInput.value = ''; // Reset input para poder subir más si desea
      });
    }

    // Publicación del Nuevo Anuncio
    var createForm = document.getElementById('form-create-product');
    var btnSubmitProd = document.getElementById('btn-submit-create-prod');

    if (createForm) {
      createForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        var title = document.getElementById('new-prod-title').value.trim();
        var category = document.getElementById('new-prod-category').value;
        var price = parseFloat(document.getElementById('new-prod-price').value) || 28.00;
        var inStock = document.getElementById('new-prod-stock').checked;
        var badge = document.getElementById('new-prod-badge').value.trim() || 'NUEVA CREACIÓN';
        var desc = document.getElementById('new-prod-desc').value.trim();

        if (selectedNewPhotos.length === 0) {
          selectedNewPhotos.push('assets/products/pulsera-rombo-oro-natural.jpg');
        }

        if (btnSubmitProd) {
          btnSubmitProd.disabled = true;
          btnSubmitProd.textContent = '⏳ Guardando fotos y publicando...';
        }

        var payload = {
          title: title,
          category: category,
          price: price,
          inStock: inStock,
          badge: badge,
          desc: desc,
          photos: selectedNewPhotos
        };

        // 1. Si Supabase está configurado, guardar en la nube 24/7 (Storage + Database)
        if (window.AtelierSupabase && window.AtelierSupabase.isConfigured()) {
          try {
            var sbProduct = await window.AtelierSupabase.createProduct(payload, selectedNewPhotos);
            if (sbProduct) {
              currentProducts.unshift(sbProduct);
              localStorage.setItem('miyuki_products_db', JSON.stringify(currentProducts));
              renderCatalogGrid();
              renderAdminProductsList();

              createForm.reset();
              selectedNewPhotos = [];
              renderPhotoPreviews();

              alert('🎉 ¡Anuncio publicado en la nube de Supabase!\nLas fotos se han guardado en el Storage 24/7 y la joya ya es visible para todo el mundo.');
              return;
            }
          } catch (sbErr) {
            console.error('Error publicando en Supabase:', sbErr);
          }
        }

        // 2. Si no hay Supabase, guardar en backend local o localStorage
        try {
          var response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            var result = await response.json();
            currentProducts.unshift(result.product);
            localStorage.setItem('miyuki_products_db', JSON.stringify(currentProducts));
            renderCatalogGrid();
            renderAdminProductsList();

            createForm.reset();
            selectedNewPhotos = [];
            renderPhotoPreviews();

            alert('🎉 ¡Anuncio publicado con éxito!\nLas fotos se han guardado en la carpeta del taller y la joya se ha registrado en data/products.json.');
          } else {
            throw new Error('El servidor respondió con un error.');
          }
        } catch (err) {
          console.warn('Guardando en almacenamiento local:', err);
          var newProd = {
            id: 'prod_' + Date.now(),
            title: title,
            price: price,
            inStock: inStock,
            category: category,
            badge: badge,
            shortDesc: desc.substring(0, 85) + (desc.length > 85 ? '...' : ''),
            desc: desc,
            photos: selectedNewPhotos
          };
          currentProducts.unshift(newProd);
          localStorage.setItem('miyuki_products_db', JSON.stringify(currentProducts));
          renderCatalogGrid();
          renderAdminProductsList();

          createForm.reset();
          selectedNewPhotos = [];
          renderPhotoPreviews();
          alert('¡Anuncio guardado y publicado en la tienda!');
        } finally {
          if (btnSubmitProd) {
            btnSubmitProd.disabled = false;
            btnSubmitProd.textContent = 'Publicar Anuncio en la Tienda →';
          }
        }
      });
    }

    // Configurar Conexión con Supabase en el Panel
    var formConnectSb = document.getElementById('form-connect-supabase');
    var sbStatusEl = document.getElementById('supabase-connection-status');
    var sbUrlInput = document.getElementById('supabase-project-url');
    var sbKeyInput = document.getElementById('supabase-anon-key');

    function updateSupabaseStatusUI() {
      if (!sbStatusEl) return;
      if (window.AtelierSupabase && window.AtelierSupabase.isConfigured()) {
        sbStatusEl.style.background = '#EAF5EA';
        sbStatusEl.style.color = '#1E7E34';
        sbStatusEl.innerHTML = '🟢 <strong>Conectado con éxito a Supabase 24/7</strong><br><small>Las joyas y fotos se guardan en la nube para siempre.</small>';
        var cfg = window.AtelierSupabase.getConfig();
        if (sbUrlInput) sbUrlInput.value = cfg.url;
        if (sbKeyInput) sbKeyInput.value = cfg.anonKey;
      } else {
        sbStatusEl.style.background = '#F9F8F6';
        sbStatusEl.style.color = '#5A534E';
        sbStatusEl.innerHTML = '⚪ <strong>Modo Local / Servidor</strong><br><small>Pega la URL y la Anon Key de tu proyecto Supabase para activar la nube 24/7 sin servidor.</small>';
      }
    }

    updateSupabaseStatusUI();

    if (formConnectSb) {
      formConnectSb.addEventListener('submit', async function (e) {
        e.preventDefault();
        var url = sbUrlInput.value.trim();
        var key = sbKeyInput.value.trim();

        if (window.AtelierSupabase) {
          window.AtelierSupabase.saveConfig(url, key);
          updateSupabaseStatusUI();

          var testProducts = await window.AtelierSupabase.fetchProducts();
          if (testProducts !== null) {
            alert('🎉 ¡Conexión con Supabase exitosa!\nA partir de ahora tu tienda funciona 24/7 en la nube.');
            fetchProductsFromDatabase();
          } else {
            alert('⚠️ Claves guardadas, pero no se ha podido conectar con la tabla "products". Revisa que hayas ejecutado el archivo supabase-setup.sql en el SQL Editor de Supabase.');
          }
        }
      });
    }

    // Cambiar Contraseña del Taller
    var formChangePwd = document.getElementById('form-change-password');
    if (formChangePwd) {
      formChangePwd.addEventListener('submit', async function (e) {
        e.preventDefault();
        var newPwd = document.getElementById('new-admin-password').value.trim();
        var confirmPwd = document.getElementById('confirm-admin-password').value.trim();

        if (newPwd.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres.');
          return;
        }

        if (newPwd !== confirmPwd) {
          alert('Las contraseñas no coinciden.');
          return;
        }

        var newHash = await computeHash(newPwd);
        localStorage.setItem('admin_custom_hash', newHash);
        formChangePwd.reset();
        alert('¡Contraseña actualizada con éxito! A partir de ahora utiliza tu nueva contraseña.');
      });
    }
  }

  // Renderizar lista en la pestaña de gestión del admin
  function renderAdminProductsList() {
    var tableBody = document.getElementById('admin-products-table-body');
    if (!tableBody) return;

    var products = getProducts();
    var html = '';

    products.forEach(function (prod) {
      var photo = (prod.photos && prod.photos.length > 0) ? prod.photos[0] : '';
      var stockBtnText = prod.inStock ? '🟢 En Stock' : '🔴 Agotado';
      var stockBtnClass = prod.inStock ? 'badge-in-stock' : 'badge-out-of-stock';

      html += `
        <tr>
          <td><img src="${photo}" alt="" class="admin-product-row-img"></td>
          <td><strong>${prod.title}</strong><br><small style="color:#888;">${prod.category || 'pulseras'}</small></td>
          <td>${parseFloat(prod.price).toFixed(2)} €</td>
          <td>
            <button type="button" class="badge-stock ${stockBtnClass}" onclick="window.toggleProductStock('${prod.id}')" style="cursor:pointer; border:none;">
              ${stockBtnText}
            </button>
          </td>
          <td>
            <button type="button" onclick="window.deleteProduct('${prod.id}')" style="color:#D9534F; cursor:pointer; font-weight:700; border:none; background:none;">
              ✕ Eliminar
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  window.toggleProductStock = async function (id) {
    var prod = currentProducts.find(function (p) { return p.id === id; });
    if (!prod) return;

    var previousStock = prod.inStock;
    prod.inStock = !prod.inStock;
    renderCatalogGrid();
    renderAdminProductsList();
    localStorage.setItem('miyuki_products_db', JSON.stringify(currentProducts));

    // Supabase
    if (window.AtelierSupabase && window.AtelierSupabase.isConfigured()) {
      await window.AtelierSupabase.toggleStock(id, previousStock);
    }

    // Backend local
    try {
      await fetch('/api/products/toggle-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
    } catch (e) {}
  };

  window.deleteProduct = async function (id) {
    if (confirm('¿Seguro que deseas eliminar este anuncio? Dejará de verse en la tienda y se borrará de la base de datos.')) {
      currentProducts = currentProducts.filter(function (p) { return p.id !== id; });
      renderCatalogGrid();
      renderAdminProductsList();
      localStorage.setItem('miyuki_products_db', JSON.stringify(currentProducts));

      // Supabase
      if (window.AtelierSupabase && window.AtelierSupabase.isConfigured()) {
        await window.AtelierSupabase.deleteProduct(id);
      }

      // Backend local
      try {
        await fetch('/api/products/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id })
        });
      } catch (e) {}
    }
  };

  // --------------------------------------------------------------------------
  // 8. FILTROS DE CATEGORÍA Y BANNER DE COOKIES
  // --------------------------------------------------------------------------
  function initCategoryFilters() {
    var filterBtns = document.querySelectorAll('.category-filter .filter-btn');
    if (!filterBtns.length) return;

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var filter = btn.getAttribute('data-filter');
        document.querySelectorAll('.products-grid .product-card').forEach(function (card) {
          var category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;

    if (!localStorage.getItem('miyuki_cookies_accepted')) {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }

    var acceptBtn = document.getElementById('btn-accept-cookies');
    var rejectBtn = document.getElementById('btn-reject-cookies');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem('miyuki_cookies_accepted', 'true');
        banner.style.display = 'none';
      });
    }

    var rejectBtn = document.getElementById('btn-reject-cookies');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem('miyuki_cookies_accepted', 'true');
        banner.style.display = 'none';
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', function () {
        localStorage.setItem('miyuki_cookies_accepted', 'false');
        banner.style.display = 'none';
      });
    }
  }

  // --------------------------------------------------------------------------
  // 9. TRAMITACIÓN DE PEDIDO Y RECIBO CON CÓDIGO BIZUM
  // --------------------------------------------------------------------------
  var activeBizumOrder = null;

  function openBizumCheckout(singleProduct) {
    var modal = document.getElementById('bizum-checkout-modal');
    if (!modal) return;

    var items = [];
    var subtotal = 0;

    if (singleProduct) {
      items = [{
        id: singleProduct.id,
        title: singleProduct.title,
        price: parseFloat(singleProduct.price),
        qty: 1
      }];
      subtotal = parseFloat(singleProduct.price);
    } else {
      if (cart.length === 0) {
        alert('Tu bolsita está vacía. Elige una joya para tramitar el pedido.');
        return;
      }
      items = cart.slice();
      subtotal = calculateSubtotal();
    }

    var shipping = subtotal >= ATELIER_CONFIG.freeShippingThreshold ? 0 : ATELIER_CONFIG.shippingPrice;
    var total = subtotal + shipping;
    var orderRef = '#MIY-' + Math.floor(100 + Math.random() * 900);

    activeBizumOrder = {
      ref: orderRef,
      items: items,
      subtotal: subtotal,
      shipping: shipping,
      total: total
    };

    var titleEl = document.getElementById('bizum-summary-title');
    var priceEl = document.getElementById('bizum-summary-price');
    var shippingEl = document.getElementById('bizum-summary-shipping');
    var totalEl = document.getElementById('bizum-summary-total');

    if (titleEl) {
      titleEl.textContent = items.length === 1 ? items[0].title : `${items.length} joyas en tu bolsita`;
    }
    if (priceEl) priceEl.textContent = subtotal.toFixed(2) + ' €';
    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? 'Gratis (Promoción)' : shipping.toFixed(2) + ' €';
      shippingEl.style.color = shipping === 0 ? '#1E7E34' : 'inherit';
    }
    if (totalEl) totalEl.textContent = total.toFixed(2) + ' €';

    var formStep = document.getElementById('bizum-step-form');
    var successStep = document.getElementById('bizum-step-success');
    if (formStep) formStep.style.display = 'block';
    if (successStep) successStep.style.display = 'none';

    var form = document.getElementById('form-bizum-checkout');
    if (form) form.reset();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeBizumCheckout() {
    var modal = document.getElementById('bizum-checkout-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  function initBizumCheckout() {
    // Copiar teléfono
    var copyPhoneBtn = document.getElementById('btn-copy-bizum-phone');
    if (copyPhoneBtn) {
      copyPhoneBtn.addEventListener('click', function () {
        navigator.clipboard.writeText('629365884').then(function () {
          copyPhoneBtn.textContent = '¡Copiado! ✓';
          setTimeout(function () { copyPhoneBtn.textContent = '📋 Copiar'; }, 2500);
        }).catch(function () {
          alert('Número Bizum: 629 365 884');
        });
      });
    }

    // Copiar código de pedido Bizum
    var copyCodeBtn = document.getElementById('btn-copy-bizum-code');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', function () {
        if (activeBizumOrder) {
          navigator.clipboard.writeText(activeBizumOrder.ref).then(function () {
            copyCodeBtn.textContent = '¡Copiado! ✓';
            setTimeout(function () { copyCodeBtn.textContent = '📋 Copiar Código'; }, 2500);
          });
        }
      });
    }

    var closeBtn = document.getElementById('btn-close-bizum-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeBizumCheckout);

    var finishBtn = document.getElementById('btn-finish-bizum-modal');
    if (finishBtn) finishBtn.addEventListener('click', closeBizumCheckout);

    var modalOverlay = document.getElementById('bizum-checkout-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeBizumCheckout();
      });
    }

    // Trigger en modal de producto ("Comprar Joya")
    var modalBuyBtn = document.getElementById('modal-btn-buy');
    if (modalBuyBtn) {
      modalBuyBtn.addEventListener('click', function () {
        var products = getProducts();
        var title = document.getElementById('modal-detail-title').textContent;
        var prod = products.find(function (p) { return p.title === title; });
        closeProductDetailModal();
        openBizumCheckout(prod || { title: title, price: 28.00 });
      });
    }

    // Trigger en carrito ("Tramitar Pedido")
    var cartCheckoutBtn = document.getElementById('btn-cart-checkout');
    if (cartCheckoutBtn) {
      cartCheckoutBtn.addEventListener('click', function () {
        closeCartDrawer();
        openBizumCheckout(null);
      });
    }

    // Formulario de envío -> Pasa a Recibo y Notifica
    var form = document.getElementById('form-bizum-checkout');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!activeBizumOrder) return;

        var name = document.getElementById('bizum-customer-name').value.trim();
        var phone = document.getElementById('bizum-customer-phone').value.trim();
        var email = document.getElementById('bizum-customer-email') ? document.getElementById('bizum-customer-email').value.trim() : '';
        var address = document.getElementById('bizum-customer-address').value.trim();
        var cp = document.getElementById('bizum-customer-cp').value.trim();
        var city = document.getElementById('bizum-customer-city').value.trim();
        var note = document.getElementById('bizum-customer-note') ? document.getElementById('bizum-customer-note').value.trim() : '';

        var fullAddress = `${address}, ${cp} ${city}`;
        var itemsSummary = activeBizumOrder.items.map(function (it) { return `${it.qty || 1}x ${it.title}`; }).join(', ');

        // Guardar pedido localmente
        try {
          var orders = JSON.parse(localStorage.getItem('miyuki_orders') || '[]');
          orders.unshift({
            ref: activeBizumOrder.ref,
            date: new Date().toISOString(),
            customer: { name: name, phone: phone, email: email, address: fullAddress, note: note },
            items: activeBizumOrder.items,
            total: activeBizumOrder.total
          });
          localStorage.setItem('miyuki_orders', JSON.stringify(orders));
        } catch (err) {}

        cart = [];
        saveCart();

        // 1. Ocultar formulario y mostrar RECIBO DIGITAL
        document.getElementById('bizum-step-form').style.display = 'none';
        var successStep = document.getElementById('bizum-step-success');
        successStep.style.display = 'block';

        // 2. Rellenar datos en el recibo
        var today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
        var dateEl = document.getElementById('receipt-date');
        if (dateEl) dateEl.textContent = today;

        document.getElementById('bizum-success-name').textContent = name;
        document.getElementById('bizum-success-phone').textContent = phone;
        document.getElementById('bizum-success-address').textContent = fullAddress;
        document.getElementById('bizum-success-items').textContent = itemsSummary;
        
        var subtotalEl = document.getElementById('bizum-success-subtotal');
        if (subtotalEl) subtotalEl.textContent = activeBizumOrder.subtotal.toFixed(2) + ' €';

        var shipEl = document.getElementById('bizum-success-shipping');
        if (shipEl) shipEl.textContent = activeBizumOrder.shipping === 0 ? 'Gratis' : activeBizumOrder.shipping.toFixed(2) + ' €';

        document.getElementById('bizum-success-amount').textContent = activeBizumOrder.total.toFixed(2) + ' €';
        document.getElementById('bizum-success-ref').textContent = activeBizumOrder.ref;

        var noteWrap = document.getElementById('bizum-success-note-wrap');
        var noteVal = document.getElementById('bizum-success-note');
        if (note && noteWrap && noteVal) {
          noteWrap.style.display = 'block';
          noteVal.textContent = note;
        } else if (noteWrap) {
          noteWrap.style.display = 'none';
        }

        // 3. Preparar mensaje de WhatsApp para el taller con el código de Bizum
        var notifyText = `📦 *NUEVO PEDIDO REGISTRADO (${activeBizumOrder.ref})*\n\n` +
          `• *Cliente:* ${name}\n` +
          `• *Teléfono:* ${phone}\n` +
          `• *Dirección de envío:* ${fullAddress}\n` +
          `• *Joya(s):* ${itemsSummary}\n` +
          `• *Total:* ${activeBizumOrder.total.toFixed(2)} €\n` +
          (note ? `• *Dedicatoria:* "${note}"\n` : '') +
          `\n🔑 *CÓDIGO DE BIZUM ASIGNADO:* ${activeBizumOrder.ref}\n` +
          `He guardado mis datos en la web y voy a emitir el Bizum a tu número con este código. ¡Muchas gracias!`;

        var waBtn = document.getElementById('btn-notify-whatsapp-receipt');
        if (waBtn) {
          waBtn.href = `https://wa.me/${ATELIER_CONFIG.whatsappNumber}?text=${encodeURIComponent(notifyText)}`;
        }

        // Abrir WhatsApp automáticamente para enviar los datos a mamá
        setTimeout(function () {
          window.open(`https://wa.me/${ATELIER_CONFIG.whatsappNumber}?text=${encodeURIComponent(notifyText)}`, '_blank');
        }, 600);
      });
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeProductDetailModal();
      closeBizumCheckout();
      var loginModal = document.getElementById('admin-login-modal');
      var dashModal = document.getElementById('admin-dashboard-modal');
      if (loginModal) loginModal.classList.remove('active');
      if (dashModal) dashModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // --------------------------------------------------------------------------
  // INICIALIZACIÓN
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    fetchProductsFromDatabase();
    loadCart();
    initCartDrawer();
    initBizumCheckout();
    initAdminPanel();
    initCategoryFilters();
    initCookieBanner();

    var closeDetailBtn = document.getElementById('btn-close-detail-modal');
    if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeProductDetailModal);

    var detailOverlay = document.getElementById('product-detail-modal');
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay) closeProductDetailModal();
      });
    }
  });

})();
