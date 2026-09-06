/**
 * SM LABELS - Blog Index UI Controller
 * 
 * Handles rendering the blog grid, category buttons, real-time search,
 * and featured post card.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.BlogService) return;

  const categoriesContainer = document.getElementById('blog-categories');
  const featuredContainer = document.getElementById('blog-featured-section');
  const gridContainer = document.getElementById('blog-grid');
  const searchInput = document.getElementById('blog-search-input');
  const searchClearBtn = document.getElementById('blog-search-clear');
  const countBadge = document.getElementById('blog-count');
  const emptyState = document.getElementById('blog-empty');
  const resetFilterBtn = document.getElementById('blog-reset-filter');

  let activeCategory = 'all';
  let activeSearch = '';

  // 1. Render Categories
  const categories = await BlogService.getCategories();
  if (categoriesContainer && categories.length > 0) {
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'blog-cat-btn px-4 py-2 rounded-full text-xs font-semibold uppercase bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors';
      btn.setAttribute('data-category', cat.name);
      btn.textContent = `${cat.name} (${cat.count})`;
      categoriesContainer.appendChild(btn);
    });

    categoriesContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.blog-cat-btn');
      if (!target) return;

      document.querySelectorAll('.blog-cat-btn').forEach(b => {
        b.classList.remove('bg-black', 'text-white', 'border-black');
        b.classList.add('bg-white', 'text-gray-700', 'border-gray-200');
      });

      target.classList.remove('bg-white', 'text-gray-700', 'border-gray-200');
      target.classList.add('bg-black', 'text-white', 'border-black');

      activeCategory = target.getAttribute('data-category');
      applyFilters();
    });
  }

  // 2. Render Featured Card
  const featuredPost = await BlogService.getFeaturedPost();
  if (featuredContainer && featuredPost) {
    featuredContainer.innerHTML = `
      <div class="glass-card rounded-3xl overflow-hidden p-6 sm:p-8 border border-amber-500/20 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-6 img-zoom-container rounded-2xl overflow-hidden h-72 sm:h-96">
          <img src="${escapeHtml(featuredPost.featuredImage)}" alt="${escapeHtml(featuredPost.imageAlt)}" class="w-full h-full object-cover"/>
        </div>
        <div class="lg:col-span-6 space-y-4">
          <div class="flex items-center space-x-3 text-xs">
            <span class="px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-bold uppercase tracking-wider">${escapeHtml(featuredPost.category)}</span>
            <span class="text-gray-500 font-medium">★ Featured Guide</span>
            <span class="text-gray-400">•</span>
            <span class="text-gray-500">${escapeHtml(featuredPost.readingTime)}</span>
          </div>
          <h2 class="font-serif text-2xl sm:text-4xl font-bold text-gray-900 leading-tight">
            <a href="blog/${encodeURIComponent(featuredPost.slug)}.html" class="hover:text-accent-gold transition-colors">
              ${escapeHtml(featuredPost.title)}
            </a>
          </h2>
          <p class="text-sm text-gray-600 font-light leading-relaxed">
            ${escapeHtml(featuredPost.excerpt)}
          </p>
          <div class="pt-2 flex items-center justify-between">
            <div class="text-xs text-gray-500">
              Published on <strong>${formatDate(featuredPost.publishedDate)}</strong>
            </div>
            <a href="blog/${encodeURIComponent(featuredPost.slug)}.html" class="px-5 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-amber-600 transition-colors flex items-center">
              Read Guide <span class="material-symbols-outlined text-sm ml-1">arrow_forward</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Search Bar listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearch = e.target.value.trim();
      if (searchClearBtn) {
        if (activeSearch) {
          searchClearBtn.classList.remove('hidden');
        } else {
          searchClearBtn.classList.add('hidden');
        }
      }
      applyFilters();
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeSearch = '';
        searchClearBtn.classList.add('hidden');
        applyFilters();
      });
    }
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      activeSearch = '';
      activeCategory = 'all';
      document.querySelectorAll('.blog-cat-btn').forEach(b => {
        if (b.getAttribute('data-category') === 'all') {
          b.classList.add('bg-black', 'text-white', 'border-black');
          b.classList.remove('bg-white', 'text-gray-700', 'border-gray-200');
        } else {
          b.classList.remove('bg-black', 'text-white', 'border-black');
          b.classList.add('bg-white', 'text-gray-700', 'border-gray-200');
        }
      });
      applyFilters();
    });
  }

  // 4. Initial render of all articles
  applyFilters();

  async function applyFilters() {
    let posts = await BlogService.getAllPosts();

    if (activeCategory && activeCategory !== 'all') {
      posts = posts.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
    }

    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      posts = posts.filter(p => {
        return (p.title && p.title.toLowerCase().includes(q)) ||
               (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
               (p.category && p.category.toLowerCase().includes(q)) ||
               (p.tags && p.tags.some(t => t.toLowerCase().includes(q)));
      });
    }

    renderGrid(posts);
  }

  function renderGrid(posts) {
    if (!gridContainer) return;

    if (countBadge) {
      countBadge.textContent = `${posts.length} ${posts.length === 1 ? 'article' : 'articles'}`;
    }

    if (posts.length === 0) {
      gridContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    gridContainer.innerHTML = posts.map(post => `
      <article class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group">
        <div>
          <div class="img-zoom-container h-56 relative">
            <img src="${escapeHtml(post.featuredImage)}" alt="${escapeHtml(post.imageAlt)}" class="w-full h-full object-cover" loading="lazy"/>
            <span class="absolute top-4 left-4 px-3 py-1 bg-black/75 backdrop-blur-md text-amber-300 text-[10px] font-bold uppercase rounded-full tracking-wider">
              ${escapeHtml(post.category)}
            </span>
          </div>
          <div class="p-6">
            <div class="flex items-center space-x-2 text-[11px] text-gray-500 mb-2 font-medium">
              <span>${formatDate(post.publishedDate)}</span>
              <span>•</span>
              <span>${escapeHtml(post.readingTime)}</span>
            </div>
            <h3 class="font-serif text-xl font-bold text-gray-900 mb-2 group-hover:text-accent-gold transition-colors leading-snug">
              <a href="blog/${post.slug}.html">
                ${escapeHtml(post.title)}
              </a>
            </h3>
            <p class="text-xs text-gray-600 leading-relaxed line-clamp-3">
              ${escapeHtml(post.excerpt)}
            </p>
          </div>
        </div>
        <div class="p-6 pt-0">
          <a href="blog/${post.slug}.html" class="inline-flex items-center text-xs font-bold uppercase tracking-wider text-black group-hover:text-amber-600 transition-colors">
            Read Full Guide <span class="material-symbols-outlined text-sm ml-1">arrow_forward</span>
          </a>
        </div>
      </article>
    `).join('');
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
