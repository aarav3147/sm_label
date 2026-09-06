/**
 * SM LABELS - Blog Service Layer
 * 
 * Provides an agnostic interface to retrieve blog posts, search, and category data.
 * When migrating to a headless CMS (Sanity, Strapi, WordPress, Contentful),
 * only this file's internal fetch implementation needs to be updated.
 */

const BlogService = {
  /**
   * Fetch all published posts
   */
  async getAllPosts() {
    if (typeof BLOG_ARTICLES !== 'undefined') {
      return BLOG_ARTICLES.filter(a => a.status === 'published');
    }
    return [];
  },

  /**
   * Fetch the featured post
   */
  async getFeaturedPost() {
    const posts = await this.getAllPosts();
    return posts.find(a => a.featured) || posts[0] || null;
  },

  /**
   * Fetch a single post by slug
   */
  async getPostBySlug(slug) {
    if (!slug) return null;
    const posts = await this.getAllPosts();
    return posts.find(a => a.slug.toLowerCase() === slug.toLowerCase()) || null;
  },

  /**
   * Fetch all unique categories with counts
   */
  async getCategories() {
    const posts = await this.getAllPosts();
    const catMap = {};
    posts.forEach(post => {
      if (post.category) {
        catMap[post.category] = (catMap[post.category] || 0) + 1;
      }
    });
    return Object.keys(catMap).map(name => ({
      name,
      count: catMap[name]
    }));
  },

  /**
   * Fetch posts by category
   */
  async getPostsByCategory(category) {
    const posts = await this.getAllPosts();
    if (!category || category === 'all') return posts;
    return posts.filter(a => a.category.toLowerCase() === category.toLowerCase());
  },

  /**
   * Multi-field search across title, excerpt, content, tags, category
   */
  async searchPosts(query) {
    const posts = await this.getAllPosts();
    if (!query || !query.trim()) return posts;
    
    const q = query.toLowerCase().trim();
    return posts.filter(post => {
      const inTitle = post.title && post.title.toLowerCase().includes(q);
      const inExcerpt = post.excerpt && post.excerpt.toLowerCase().includes(q);
      const inContent = post.content && post.content.toLowerCase().includes(q);
      const inCategory = post.category && post.category.toLowerCase().includes(q);
      const inTags = post.tags && post.tags.some(tag => tag.toLowerCase().includes(q));
      return inTitle || inExcerpt || inContent || inCategory || inTags;
    });
  },

  /**
   * Fetch related posts for a given slug
   */
  async getRelatedPosts(currentSlug, limit = 3) {
    const current = await this.getPostBySlug(currentSlug);
    if (!current) return [];
    
    const allPosts = await this.getAllPosts();
    const otherPosts = allPosts.filter(p => p.slug !== currentSlug);

    // If explicit related slugs exist
    if (current.relatedArticleSlugs && current.relatedArticleSlugs.length > 0) {
      const explicitRelated = otherPosts.filter(p => current.relatedArticleSlugs.includes(p.slug));
      if (explicitRelated.length >= limit) return explicitRelated.slice(0, limit);
      
      const remainder = otherPosts.filter(p => !current.relatedArticleSlugs.includes(p.slug));
      return [...explicitRelated, ...remainder].slice(0, limit);
    }

    // Otherwise match by category
    const sameCat = otherPosts.filter(p => p.category === current.category);
    const otherCat = otherPosts.filter(p => p.category !== current.category);
    return [...sameCat, ...otherCat].slice(0, limit);
  }
};

// Global attachment for vanilla JS browser runtime
if (typeof window !== 'undefined') {
  window.BlogService = BlogService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlogService;
}
