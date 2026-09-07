import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BLOG_POSTS } from '../data/blogPosts';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { SeoHead } from '../components/seo/SeoHead';
import {
  getBlogPostSchema,
  getBreadcrumbSchema,
  DEFAULT_OG_IMAGE,
} from '../data/seo';
import { CANONICAL_DOMAIN } from '../utils/constants';
import {
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Share2,
  Check,
  Sparkles,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Home,
} from 'lucide-react';

function renderInlineContent(text: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  if (!linkRegex.test(text)) {
    return text;
  }
  linkRegex.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const linkText = match[1];
    const linkUrl = match[2];
    if (linkUrl.startsWith('/')) {
      parts.push(
        <Link
          key={`${match.index}-${linkUrl}`}
          to={linkUrl}
          className="text-brand-purple-600 font-semibold hover:underline hover:text-brand-purple-700 transition"
        >
          {linkText}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={`${match.index}-${linkUrl}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-purple-600 font-semibold hover:underline hover:text-brand-purple-700 transition"
        >
          {linkText}
        </a>
      );
    }
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts;
}

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [copiedLink, setCopiedLink] = useState(false);

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-6">
        <SeoHead
          title="Article Not Found | Meoow AI"
          metaDescription="The requested technical interview guide could not be found on Meoow AI."
          noIndex={true}
        />
        <h1 className="text-3xl font-bold text-brand-navy-950">Article Not Found</h1>
        <p className="text-slate-600">Looks like this article took the wrong interview question.</p>
        <Button href="/blog" variant="primary" size="md">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Button>
      </div>
    );
  }

  const relatedPosts = BLOG_POSTS.filter((p) =>
    post.relatedSlugs?.includes(p.slug)
  ).slice(0, 3);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const breadcrumbItems = [
    { name: 'Home', url: `${CANONICAL_DOMAIN}/` },
    { name: 'Blog', url: `${CANONICAL_DOMAIN}/blog` },
    { name: post.title, url: post.canonicalUrl },
  ];

  const structuredData = [
    getBlogPostSchema(post),
    getBreadcrumbSchema(breadcrumbItems),
  ];

  // Avoid redundant brand suffix if the article meta title already contains or ends with the brand
  const pageTitle =
    post.metaTitle.includes('Meoow AI') || post.metaTitle.includes('Meoow')
      ? post.metaTitle
      : `${post.metaTitle} | Meoow AI`;

  return (
    <div className="py-12 space-y-16">
      {/* 0. SEO HEAD CONFIGURATION */}
      <SeoHead
        title={pageTitle}
        metaDescription={post.metaDescription}
        canonicalUrl={post.canonicalUrl}
        keywords={post.tags}
        ogTitle={post.metaTitle}
        ogDescription={post.metaDescription}
        ogType="article"
        ogImage={DEFAULT_OG_IMAGE}
        twitterTitle={post.metaTitle}
        twitterDescription={post.metaDescription}
        twitterCard="summary_large_image"
        noIndex={false}
        structuredData={structuredData}
      />

      {/* 1. ARTICLE HEADER & BREADCRUMBS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Visual Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li className="flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <Link to="/" className="hover:text-brand-purple-600 transition">
                Home
              </Link>
            </li>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <li>
              <Link to="/blog" className="hover:text-brand-purple-600 transition">
                Blog
              </Link>
            </li>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <li className="text-slate-800 font-medium truncate max-w-[200px] sm:max-w-sm">
              {post.category}
            </li>
          </ol>
        </nav>

        <div className="flex items-center justify-between pt-2">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-purple-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Articles
          </Link>
          <Badge variant="purple" size="sm">
            {post.category}
          </Badge>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-[1.2]">
          {post.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          {post.excerpt}
        </p>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-slate-200 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <User className="w-4 h-4 text-brand-purple-600" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              {post.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              {post.readTime}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition text-xs font-semibold"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Article</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 2. MAIN BODY & TABLE OF CONTENTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Table of Contents (Sticky on desktop) */}
          <aside className="lg:col-span-4 hidden lg:block sticky top-24 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-navy-950">
              <BookOpen className="w-4 h-4 text-brand-purple-600" />
              <span>Table of Contents</span>
            </div>
            <nav className="space-y-2 text-xs">
              {post.tableOfContents.map((toc) => (
                <a
                  key={toc.id}
                  href={`#${toc.id}`}
                  className="block text-slate-600 hover:text-brand-purple-600 hover:translate-x-0.5 transition-transform py-1 border-l-2 border-transparent hover:border-brand-purple-500 pl-2 leading-snug"
                >
                  {toc.title}
                </a>
              ))}
            </nav>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="text-[11px] text-slate-500">
                ⚡ Ready to test these techniques?
              </div>
              <Button href="/download" variant="primary" size="sm" className="w-full justify-center">
                Claim 30 Free Credits
              </Button>
            </div>
          </aside>

          {/* Right Article Content */}
          <article className="lg:col-span-8 bg-white p-6 sm:p-10 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-8 text-slate-800 leading-relaxed">
            {/* Render article markdown formatted content */}
            <div className="prose prose-slate max-w-none prose-headings:text-brand-navy-950 prose-headings:font-bold prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-p:text-base prose-p:leading-relaxed prose-code:text-brand-purple-600 prose-code:bg-brand-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4 prose-li:my-1">
              {post.content.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('## ')) {
                  const match = paragraph.match(/## (.+?)(?: \{#(.+?)\})?$/);
                  const title = match ? match[1] : paragraph.replace('## ', '');
                  const id = match && match[2] ? match[2] : undefined;
                  return (
                    <h2 key={idx} id={id} className="scroll-mt-24 text-2xl sm:text-3xl font-bold text-brand-navy-950 pt-4 border-t border-slate-100 first:border-t-0 first:pt-0">
                      {title}
                    </h2>
                  );
                }
                if (paragraph.startsWith('### ')) {
                  const title = paragraph.replace('### ', '');
                  return (
                    <h3 key={idx} className="text-xl font-bold text-brand-navy-900 mt-6 mb-2">
                      {title}
                    </h3>
                  );
                }
                if (paragraph.startsWith('```')) {
                  const codeContent = paragraph.replace(/```[a-z]*\n?/g, '');
                  return (
                    <div key={idx} className="my-6 bg-slate-900 text-slate-100 p-4 sm:p-5 rounded-2xl font-mono text-xs sm:text-sm overflow-x-auto border border-slate-800 leading-relaxed">
                      <pre>{codeContent}</pre>
                    </div>
                  );
                }
                if (paragraph.startsWith('> ')) {
                  return (
                    <blockquote key={idx} className="my-6 p-4 rounded-xl bg-purple-50 border-l-4 border-brand-purple-600 text-brand-navy-900 text-sm italic">
                      {paragraph.replace('> ', '')}
                    </blockquote>
                  );
                }
                return (
                  <p key={idx} className="text-base text-slate-700 leading-relaxed my-4">
                    {renderInlineContent(paragraph)}
                  </p>
                );
              })}
            </div>

            {/* In-Article Promotion Card */}
            <div className="my-8 p-6 sm:p-8 bg-gradient-to-r from-brand-navy-900 to-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-brand-purple-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Practice Technical Interviews Free</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Get 30 Free Credits with Meoow AI Copilot
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Experience real-time voice transcription, single-key screen capture (<Link to="/shortcuts" className="text-brand-purple-400 underline hover:text-brand-purple-300">Ctrl+Shift+A</Link>), and sub-second Groq answers in a sleek desktop overlay.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button href="/download" variant="primary" size="md">
                  Download Free Desktop Client
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button href="/features" variant="outline" size="md" className="border-slate-700 text-white hover:bg-slate-800">
                  Explore Features
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Topics:</span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* 3. ARTICLE-SPECIFIC FAQS */}
      {post.faqs && post.faqs.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-brand-navy-950">Article Questions & Key Takeaways</h2>
            <p className="text-slate-600 text-sm">Common questions related to this guide.</p>
          </div>
          <Accordion items={post.faqs} />
        </section>
      )}

      {/* 4. RELATED ARTICLES (TOPIC CLUSTERS) */}
      {relatedPosts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <h2 className="text-2xl font-bold text-brand-navy-950 text-center">
            Related Interview Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedPosts.map((rPost) => (
              <Card key={rPost.slug} className="p-6 flex flex-col justify-between space-y-3 group">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-brand-purple-600 bg-brand-purple-50 px-2 py-0.5 rounded">
                    {rPost.category}
                  </span>
                  <h3 className="text-base font-bold text-brand-navy-950 group-hover:text-brand-purple-600 transition-colors leading-snug">
                    <Link to={`/blog/${rPost.slug}`}>{rPost.title}</Link>
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{rPost.excerpt}</p>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{rPost.readTime}</span>
                  <Link to={`/blog/${rPost.slug}`} className="text-brand-purple-600 font-semibold group-hover:underline">
                    Read Guide →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 5. FINAL CTA */}
      <CtaSection />
    </div>
  );
};
