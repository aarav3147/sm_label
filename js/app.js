// SM Labels - Application Logic & Interactivity

const WHATSAPP_NUMBER = "919315458189";
const COMPANY_EMAIL = "enterprisessm.delhi@gmail.com";

// API Endpoint for Vercel Serverless Function
const API_ENDPOINT = window.SM_LABELS_API_URL || '/api/submit-enquiry';

document.addEventListener('DOMContentLoaded', () => {
  initShaderBackground();
  initProductFilters();
  initNavigation();
  initContactForms();
  initWhatsAppButtons();
  initPhoneInputs();
});

/* ==========================================================================
   1. NAVIGATION & MOBILE DRAWER
   ========================================================================== */
function initNavigation() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMenu.classList.toggle('hidden');
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileMenu.classList.add('hidden');
      }
    });
  }
}

/* ==========================================================================
   2. PRODUCT FILTER SYSTEM (Products Page)
   ========================================================================== */
function initProductFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');

  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('bg-black', 'text-white', 'border-black');
        b.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100', 'border-gray-200');
      });

      btn.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-100', 'border-gray-200');
      btn.classList.add('bg-black', 'text-white', 'border-black');

      const filterVal = btn.getAttribute('data-filter');

      productCards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        const cardType = card.getAttribute('data-type');

        if (filterVal === 'all') {
          card.style.display = 'block';
        } else if (filterVal === 'clothing-labels' && cardCat === 'clothing-labels') {
          card.style.display = 'block';
        } else if (filterVal === 'tags' && cardCat === 'tags') {
          card.style.display = 'block';
        } else if (filterVal === cardType) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   3. WHATSAPP ACTION BUTTONS (+91-9315458189)
   ========================================================================== */
function initWhatsAppButtons() {
  const whatsappBtns = document.querySelectorAll('.whatsapp-trigger');
  
  whatsappBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const product = btn.getAttribute('data-product') || 'SM Labels Garment Labels & Trims';
      const message = `Hi SM Labels, I would like to inquire about ${product}. Please share your catalog options, pricing, and sample details.`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    });
  });
}

/* ==========================================================================
   4. STRICT PHONE INPUT SANITIZATION & RESTRICTION
   - Numbers only
   - Auto-removes non-digits on keypress and paste
   - Maximum 10 digits
   ========================================================================== */
function initPhoneInputs() {
  const phoneInputs = document.querySelectorAll('input[type="tel"], .phone-input');

  phoneInputs.forEach(input => {
    // Sanitize on input event
    input.addEventListener('input', (e) => {
      const raw = e.target.value;
      // Strip everything except numbers 0-9
      const cleaned = raw.replace(/[^0-9]/g, '');
      // Limit to 10 digits
      const truncated = cleaned.slice(0, 10);
      if (raw !== truncated) {
        e.target.value = truncated;
      }
    });

    // Handle paste event specifically
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const cleaned = pasted.replace(/[^0-9]/g, '').slice(0, 10);
      input.value = cleaned;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

/* ==========================================================================
   5. CONTACT FORM & SUBMISSION SYSTEM
   ========================================================================== */
function initContactForms() {
  const forms = document.querySelectorAll('.sm-contact-form, #inquiry-form');

  forms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const container = form.closest('.sm-form-container') || document.getElementById('inquiry-form-container');
      const errorBox = form.querySelector('.sm-form-error') || document.getElementById('inquiry-error-msg');
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Requirement';

      // Clear previous error
      if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerHTML = '';
      }

      // Read form fields
      const nameInput = form.querySelector('input[name="name"], #inq-name');
      const countryCodeSelect = form.querySelector('select[name="countryCode"], #inq-country-code');
      const phoneInput = form.querySelector('input[name="phone"], #inq-phone');
      const emailInput = form.querySelector('input[name="email"], #inq-email');
      const productSelect = form.querySelector('select[name="product"], #inq-product');
      const companyInput = form.querySelector('input[name="company"], #inq-company');
      const quantityInput = form.querySelector('input[name="quantity"], #inq-quantity');
      const messageInput = form.querySelector('textarea[name="message"], #inq-notes');
      const honeypotInput = form.querySelector('input[name="website"], #inq-website');

      const name = nameInput ? nameInput.value.trim() : '';
      const countryCode = countryCodeSelect ? countryCodeSelect.value.trim() : '+91';
      const rawPhone = phoneInput ? phoneInput.value.trim() : '';
      const phoneDigits = rawPhone.replace(/[^0-9]/g, '');
      const email = emailInput ? emailInput.value.trim() : '';
      const product = productSelect ? productSelect.value : 'Custom Garment Labels';
      const company = companyInput ? companyInput.value.trim() : '';
      const quantity = quantityInput ? quantityInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';
      const honeypot = honeypotInput ? honeypotInput.value.trim() : '';

      // --- Honeypot Anti-Spam Check ---
      if (honeypot.length > 0) {
        showToast('Enquiry received.');
        form.reset();
        return;
      }

      // --- Validation Rules ---
      if (!name || name.length < 2) {
        showFormError(errorBox, 'Please enter your Name (at least 2 characters).');
        if (nameInput) nameInput.focus();
        return;
      }

      if (!phoneDigits) {
        showFormError(errorBox, 'Please enter your 10-digit Phone / WhatsApp number.');
        if (phoneInput) phoneInput.focus();
        return;
      }

      if (phoneDigits.length !== 10) {
        showFormError(errorBox, `Phone number must be exactly 10 digits (currently ${phoneDigits.length} digits).`);
        if (phoneInput) phoneInput.focus();
        return;
      }

      if (!email) {
        showFormError(errorBox, 'Please enter your Email address.');
        if (emailInput) emailInput.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showFormError(errorBox, 'Please enter a valid Email address (e.g. name@brand.com).');
        if (emailInput) emailInput.focus();
        return;
      }

      // Disable button & show spinner
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = `
          <span class="inline-block animate-spin mr-2">⏳</span> Submitting Requirement...
        `;
      }

      const payload = {
        name,
        countryCode,
        phone: phoneDigits,
        email,
        product,
        company,
        quantity,
        message,
        website: honeypot
      };

      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success) {
          form.reset();

          if (container) {
            container.innerHTML = `
              <div class="text-center py-10 px-6 space-y-4 animate-fadeIn">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center mb-2 shadow-inner">
                  <span class="material-symbols-outlined text-3xl">task_alt</span>
                </div>
                <h3 class="font-serif text-3xl font-bold text-gray-900">Thank You, ${escapeHtml(name)}!</h3>
                <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                  Your requirement for <strong class="text-black">${escapeHtml(product)}</strong> has been received. 
                  Our manufacturing team will review your specifications and contact you at <strong class="text-black">${escapeHtml(countryCode)} ${escapeHtml(phoneDigits)}</strong>.
                </p>
                
                <div class="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 max-w-md mx-auto text-left space-y-1">
                  <div class="font-bold flex items-center">
                    <span class="material-symbols-outlined text-base mr-1">mark_email_read</span> Inquiry Dispatched
                  </div>
                  <p>A notification summary has been routed to our production desk at <strong>${COMPANY_EMAIL}</strong>.</p>
                </div>

                <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <button onclick="location.reload()" class="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-amber-600 transition-colors">
                    Submit Another Requirement
                  </button>
                  <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20SM%20Labels,%20I%20just%20submitted%20an%20inquiry%20for%20${encodeURIComponent(product)}." target="_blank" class="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-500 transition-colors flex items-center justify-center">
                    <span class="material-symbols-outlined text-sm mr-1.5">chat</span> Urgent WhatsApp Contact
                  </a>
                </div>
              </div>
            `;
          }
          showToast(`Thank you ${name}! Your requirement has been submitted.`);
        } else {
          const errorMsg = result.error || 'Unable to submit your requirement. Please verify the information or reach out on WhatsApp (+91-9315458189).';
          showFormError(errorBox, errorMsg);
          restoreSubmitBtn(submitBtn, originalBtnHtml);
        }
      } catch (err) {
        console.error('Submission network error:', err);
        showFormError(errorBox, 'Network issue detected. Please check your connection or contact us directly on WhatsApp (+91-9315458189).');
        restoreSubmitBtn(submitBtn, originalBtnHtml);
      }
    });
  });

  function showFormError(box, message) {
    if (box) {
      box.innerHTML = `
        <div class="flex items-start space-x-2">
          <span class="material-symbols-outlined text-base text-red-600 mt-0.5">error</span>
          <span>${escapeHtml(message)}</span>
        </div>
      `;
      box.classList.remove('hidden');
    } else {
      showToast(message);
    }
  }

  function restoreSubmitBtn(btn, html) {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = html;
    }
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') {
    str = (str !== null && str !== undefined) ? String(str) : '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.escapeHtml = escapeHtml;

/* ==========================================================================
   6. WEBGL SHADER AMBIENT BACKGROUND
   ========================================================================== */
function initShaderBackground() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;

  function syncSize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  syncSize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vs = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fs = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    void main() {
      vec2 uv = v_texCoord;
      float noise = sin(uv.x * 3.0 + u_time * 0.4) * cos(uv.y * 2.0 + u_time * 0.3);
      float noise2 = sin(uv.y * 4.0 - u_time * 0.3) * cos(uv.x * 5.0 + u_time * 0.2);

      vec3 color1 = vec3(0.976, 0.965, 0.941);
      vec3 color2 = vec3(0.880, 0.865, 0.835);

      vec3 finalColor = mix(color1, color2, uv.y + noise * 0.08 + noise2 * 0.04);
      float shimmer = pow(max(0.0, sin(uv.x * 8.0 + uv.y * 8.0 + u_time * 0.8)), 18.0) * 0.025;
      finalColor += shimmer;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');

  function render(t) {
    syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
}

function showToast(msg) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'fixed bottom-6 left-6 bg-black text-white px-6 py-4 rounded-xl shadow-2xl z-50 transition-all transform translate-y-10 opacity-0 flex items-center space-x-3 border border-amber-500/30';
    document.body.appendChild(toast);
  }

  // Safe DOM structure with textContent to prevent DOM XSS
  toast.innerHTML = `
    <span class="material-symbols-outlined text-amber-400">check_circle</span>
    <span class="text-sm font-medium" id="toast-message-text"></span>
  `;
  const textEl = toast.querySelector('#toast-message-text');
  if (textEl) {
    textEl.textContent = msg || '';
  }

  setTimeout(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
  }, 4000);
}

window.showToast = showToast;
