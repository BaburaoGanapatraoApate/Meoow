import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getSeoForPath,
  PageSeoConfig,
  DEFAULT_OG_IMAGE,
} from '../../data/seo';
import { CANONICAL_DOMAIN, BRAND_NAME } from '../../utils/constants';

export interface SeoHeadProps extends Partial<PageSeoConfig> {
  // Allow overriding any SEO parameter on a per-page / per-post basis
}

/**
 * Helper to update or create a <meta> tag
 */
function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Helper to update or create a <link rel="canonical"> tag
 */
function setCanonicalLink(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Helper to inject or update JSON-LD Schema
 */
function setJsonLdScript(id: string, data: object | object[]) {
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export const SeoHead: React.FC<SeoHeadProps> = (props) => {
  const { pathname } = useLocation();
  const routeSeo = getSeoForPath(pathname);

  const title = props.title || routeSeo.title;
  const metaDescription = props.metaDescription || routeSeo.metaDescription;
  const canonicalUrl = props.canonicalUrl || routeSeo.canonicalUrl || `${CANONICAL_DOMAIN}${pathname}`;
  const keywords = props.keywords || routeSeo.keywords || [];
  const ogTitle = props.ogTitle || routeSeo.ogTitle || title;
  const ogDescription = props.ogDescription || routeSeo.ogDescription || metaDescription;
  const ogType = props.ogType || routeSeo.ogType || 'website';
  const ogImage = props.ogImage || routeSeo.ogImage || DEFAULT_OG_IMAGE;
  const twitterTitle = props.twitterTitle || routeSeo.twitterTitle || ogTitle;
  const twitterDescription = props.twitterDescription || routeSeo.twitterDescription || ogDescription;
  const twitterCard = props.twitterCard || routeSeo.twitterCard || 'summary_large_image';
  const noIndex = props.noIndex !== undefined ? props.noIndex : routeSeo.noIndex;
  const structuredData = props.structuredData || routeSeo.structuredData;

  useEffect(() => {
    // 1. Title
    document.title = title;

    // 2. Standard Meta
    setMetaTag('name', 'description', metaDescription);
    if (keywords.length > 0) {
      setMetaTag('name', 'keywords', keywords.join(', '));
    }
    setMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // 3. Canonical Link
    setCanonicalLink(canonicalUrl);

    // 4. OpenGraph Tags
    setMetaTag('property', 'og:title', ogTitle);
    setMetaTag('property', 'og:description', ogDescription);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:site_name', BRAND_NAME);
    setMetaTag('property', 'og:locale', 'en_US');

    // 5. Twitter Card Tags
    setMetaTag('name', 'twitter:card', twitterCard);
    setMetaTag('name', 'twitter:title', twitterTitle);
    setMetaTag('name', 'twitter:description', twitterDescription);
    setMetaTag('name', 'twitter:image', ogImage);

    // 6. JSON-LD Structured Data
    if (structuredData) {
      setJsonLdScript('meoow-structured-data', structuredData);
    } else {
      const existingScript = document.getElementById('meoow-structured-data');
      if (existingScript) {
        existingScript.remove();
      }
    }
  }, [
    title,
    metaDescription,
    canonicalUrl,
    keywords,
    ogTitle,
    ogDescription,
    ogType,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterCard,
    noIndex,
    structuredData,
  ]);

  return null; // Head manager does not render any visible DOM
};

