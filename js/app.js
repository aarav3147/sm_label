// SM Labels - Application Logic & Interactivity

const WHATSAPP_NUMBER = "919315458189";
const COMPANY_EMAIL = "enterprisessm.delhi@gmail.com";

// API Endpoint for Vercel Serverless Function
// Can be customized via window.SM_LABELS_API_URL if hosted cross-domain
const API_ENDPOINT = window.SM_LABELS_API_URL || '/api/submit-enquiry';

document.addEventListener('DOMContentLoaded', () => {
  initShaderBackground();
  initProductFilters();
  initNavigation();
  initInquiryForm();
  initWhatsAppButtons();
});

/* ==========================================================================
   1. NAVIGATION & MOBILE MENU
   ========================================================================== */
function initNavigation() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

/* ==========================================================================
   2. PRODUCT FILTER SYSTEM
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
   3. SECONDARY WHATSAPP CONTACT (+91-9315458189)
   ========================================================================== */
function initWhatsAppButtons() {
  const whatsappBtns = document.querySelectorAll('.whatsapp-trigger');
  
  whatsappBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const product = btn.getAttribute('data-product') || 'SM Labels Clothing Labels & Tags';
      const message = `Hi SM Labels, I am interested in getting a quote for ${product}. Please assist me with sample options and custom pricing.`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    });
  });
}

/* ==========================================================================
   4. INQUIRY FORM SUBMISSION -> VERCEL API ENDPOINT (/api/submit-enquiry)
   ========================================================================== */
function initInquiryForm() {
  const inquiryForm = document.getElementById('inquiry-form');
  const formContainer = document.getElementById('inquiry-form-container');
  const errorContainer = document.getElementById('inquiry-error-msg');

  if (!inquiryForm) return;

  inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide any previous error message
    if (errorContainer) {
      errorContainer.classList.add('hidden');
      errorContainer.innerHTML = '';
    }

    const submitBtn = inquiryForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Quote Request';

    // 1. Gather Form Data
    const name = document.getElementById('inq-name')?.value?.trim() || '';
    const company = document.getElementById('inq-company')?.value?.trim() || '';
    const phone = document.getElementById('inq-phone')?.value?.trim() || '';
    const email = document.getElementById('inq-email')?.value?.trim() || '';
    const product = document.getElementById('inq-product')?.value || 'General Requirement';
    const quantity = document.getElementById('inq-quantity')?.value?.trim() || '';
    const message = document.getElementById('inq-notes')?.value?.trim() || '';
    const website = document.getElementById('inq-website')?.value || ''; // Honeypot field

    // 2. Client-side Anti-Spam & Validation
    if (website && website.length > 0) {
      // Bot trapped in honeypot
      showToast('Enquiry received.');
      inquiryForm.reset();
      return;
    }

    if (!name || name.length < 2) {
      displayFormError('Please enter your Name (at least 2 characters).');
      return;
    }

    if (!phone || phone.length < 6) {
      displayFormError('Please enter a valid Phone or WhatsApp Number.');
      return;
    }

    // 3. Disable submit button & show loading spinner
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
      submitBtn.innerHTML = `
        <span class="inline-block animate-spin mr-2">⏳</span> Processing Request...
      `;
    }

    const payload = {
      name: name,
      company: company,
      phone: phone,
      email: email,
      product: product,
      quantity: quantity,
      message: message,
      website: website
    };

    try {
      // 4. POST JSON request to Vercel Serverless Endpoint
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
        // Reset form ONLY on successful submission
        inquiryForm.reset();

        // Render Success Thank You UI
        if (formContainer) {
          formContainer.innerHTML = `
            <div class="text-center py-10 px-6 space-y-4 animate-fadeIn">
              <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center mb-2 shadow-inner">
                <span class="material-symbols-outlined text-3xl">task_alt</span>
              </div>
              <h3 class="font-serif text-3xl font-bold text-gray-900">Thank You, ${escapeHtml(name)}!</h3>
              <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                Your inquiry for <strong class="text-black">${escapeHtml(product)}</strong> has been received successfully. 
                Our team will review your specifications and reach out to you directly at <strong class="text-black">${escapeHtml(phone)}</strong> ${email ? `/ <strong class="text-black">${escapeHtml(email)}</strong>` : ''}.
              </p>
              
              <div class="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 max-w-md mx-auto text-left space-y-1">
                <div class="font-bold flex items-center">
                  <span class="material-symbols-outlined text-base mr-1">mark_email_read</span> Instant Notification Dispatched
                </div>
                <p>A notification summary has been sent to our sales desk at <strong>${COMPANY_EMAIL}</strong>.</p>
              </div>

              <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button onclick="location.reload()" class="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-amber-600 transition-colors">
                  Submit Another Inquiry
                </button>
                <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20SM%20Labels,%20I%20just%20submitted%20an%20inquiry%20for%20${encodeURIComponent(product)}." target="_blank" class="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-500 transition-colors flex items-center justify-center">
                  <span class="material-symbols-outlined text-sm mr-1.5">chat</span> Urgent WhatsApp Contact
                </a>
              </div>
            </div>
          `;
        }
        showToast(`Thank you ${name}! Your inquiry has been submitted.`);
      } else {
        const errorMsg = result.error || 'Unable to process your inquiry right now. Please try again or reach out on WhatsApp.';
        displayFormError(errorMsg);
        resetSubmitBtn(submitBtn, originalBtnHtml);
      }

    } catch (err) {
      console.error('Submission error:', err);
      displayFormError('Network connection issue. Please verify your connection or contact us via WhatsApp.');
      resetSubmitBtn(submitBtn, originalBtnHtml);
    }
  });

  function displayFormError(msg) {
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="flex items-center space-x-2">
          <span class="material-symbols-outlined text-base">error</span>
          <span>${escapeHtml(msg)}</span>
        </div>
      `;
      errorContainer.classList.remove('hidden');
    } else {
      showToast(msg);
    }
  }

  function resetSubmitBtn(btn, html) {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = html;
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ==========================================================================
   5. WEBGL SHADER BACKGROUND
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

  toast.innerHTML = `
    <span class="material-symbols-outlined text-amber-400">check_circle</span>
    <span class="text-sm font-medium">${msg}</span>
  `;

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
