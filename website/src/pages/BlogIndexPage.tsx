import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CtaSection } from '../components/ui/CtaSection';
import { BLOG_POSTS, BlogPost } from '../data/blogPosts';
import { Search, BookOpen, ArrowRight, Clock } from 'lucide-react';

export const BlogIndexPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    'All',
    'Interview Prep',
    'AI Interview Help',
    'DSA',
    'System Design',
    'Behavioral',
    'Career',
  ];

  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCategory =
      selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const featuredPost = BLOG_POSTS[0];

  return (
    <div className="space-y-16 sm:space-y-24 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Technical Knowledge Base</span>
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Become Better at{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Technical Interviews
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Deep dives on algorithmic patterns, distributed system design frameworks, behavioral STAR coaching, and AI-native preparation strategies.
        </p>
      </section>

      {/* 2. FEATURED ARTICLE BANNER */}
      {featuredPost && selectedCategory === 'All' && !searchQuery && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 sm:p-12 bg-gradient-to-br from-white via-purple-50/20 to-white border-2 border-brand-purple-300 shadow-md group">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Badge variant="purple" size="sm">
                    Featured Article
                  </Badge>
                  <span className="text-slate-500 font-medium">{featuredPost.category}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{featuredPost.readTime}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy-950 group-hover:text-brand-purple-600 transition-colors leading-tight">
                  <Link to={`/blog/${featuredPost.slug}`}>{featuredPost.title}</Link>
                </h2>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">
                  {featuredPost.excerpt}
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <Button href={`/blog/${featuredPost.slug}`} variant="primary" size="md">
                    <span>Read Featured Guide</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900 text-slate-200 p-6 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-brand-purple-400">
                  Inside This Article:
                </div>
                <ul className="text-xs space-y-2 text-slate-300">
                  {featuredPost.tableOfContents.slice(0, 4).map((toc) => (
                    <li key={toc.id} className="flex items-start gap-2">
                      <span className="text-brand-purple-400 font-bold">→</span>
                      <span>{toc.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* 3. SEARCH & CATEGORY FILTERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-brand-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search articles & topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
            />
          </div>
        </div>

        {/* 4. ARTICLES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((post: BlogPost) => (
            <Card key={post.slug} className="p-6 sm:p-8 flex flex-col justify-between space-y-4 group">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-brand-purple-600 bg-brand-purple-50 px-2.5 py-0.5 rounded-full border border-brand-purple-100">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-brand-navy-950 group-hover:text-brand-purple-600 transition-colors leading-snug">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-400">{post.date}</div>
                <Link
                  to={`/blog/${post.slug}`}
                  className="font-bold text-brand-purple-600 hover:text-brand-purple-700 flex items-center gap-1 group-hover:underline"
                >
                  Read Article
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-16 space-y-4 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-600 font-medium">No articles found matching your filter criteria.</p>
            <Button onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }} variant="secondary" size="sm">
              Reset Filters
            </Button>
          </div>
        )}
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection />
    </div>
  );
};
