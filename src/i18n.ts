export const LOCALES = ["en", "cn"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  cn: "CN",
};

type Dictionary = {
  nav: {
    home: string;
    posts: string;
    tags: string;
    cv: string;
    about: string;
    archives: string;
    contact: string;
  };
  home: {
    greeting: string;
    headline: string;
    role: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    featured: string;
    latest: string;
    allPosts: string;
  };
  pages: {
    postsTitle: string;
    postsDesc: string;
    tagsTitle: string;
    tagsDesc: string;
    archivesTitle: string;
    archivesDesc: string;
    cvTitle: string;
    cvDesc: string;
    aboutTitle: string;
    tagPrefix: string;
    tagDesc: (tagName: string) => string;
    prev: string;
    next: string;
    previousPost: string;
    nextPost: string;
    shareSummary: string;
  };
  footer: {
    copyright: string;
  };
};

export const DICTIONARY: Record<Locale, Dictionary> = {
  en: {
    nav: {
      home: "Home",
      posts: "Posts",
      tags: "Tags",
      cv: "CV",
      about: "About",
      archives: "Archives",
      contact: "Contact",
    },
    home: {
      greeting: "Hey there",
      headline: "I'm Lei",
      role: "System architect and software engineer — AI inference platforms, infrastructure tooling, and AI-agent tools",
      intro:
        "Ten-plus years building scalable platforms and developer tools. Today I focus on AI inference infrastructure at Verda Cloud — and on the tooling layer that makes advanced AI usable in real products. I also build products from zero to one as a solo builder. This site is where I share what I build, what I learn, and how I think about these systems.",
      primaryCta: "Let's connect",
      secondaryCta: "Browse posts",
      featured: "Selected writing",
      latest: "Latest from the blog",
      allPosts: "All Posts",
    },
    pages: {
      postsTitle: "Posts",
      postsDesc: "All the articles I've posted.",
      tagsTitle: "Tags",
      tagsDesc: "All the tags used in posts.",
      archivesTitle: "Archives",
      archivesDesc: "All the articles I've archived.",
      cvTitle: "CV",
      cvDesc:
        "A concise overview of my background, experience, and current focus.",
      aboutTitle: "About",
      tagPrefix: "Tag:",
      tagDesc: tagName => `All the articles with the tag "${tagName}".`,
      prev: "Prev",
      next: "Next",
      previousPost: "Previous Post",
      nextPost: "Next Post",
      shareSummary:
        "Three interfaces share one gateway instead of requiring three separate integrations.",
    },
    footer: {
      copyright: "All rights reserved.",
    },
  },
  cn: {
    nav: {
      home: "首页",
      posts: "文章",
      tags: "标签",
      cv: "简历",
      about: "关于",
      archives: "归档",
      contact: "联系",
    },
    home: {
      greeting: "你好",
      headline: "我是 Lei",
      role: "系统架构师与软件工程师——AI 推理平台、基础设施工具、AI Agent 工具",
      intro:
        "十余年构建可扩展平台与开发者工具的经验。如今我把重心放在 Verda Cloud 的 AI 推理基础设施，以及让高级 AI 真正落到产品里的那一层工具。同时也作为独立构建者，把产品从零做到一。这个站点用来分享我的构建、思考和从中学到的东西。",
      primaryCta: "联系我",
      secondaryCta: "浏览文章",
      featured: "精选内容",
      latest: "最新文章",
      allPosts: "所有文章",
    },
    pages: {
      postsTitle: "文章",
      postsDesc: "这里收录了我发布的所有文章。",
      tagsTitle: "标签",
      tagsDesc: "这里是文章中使用的所有标签。",
      archivesTitle: "归档",
      archivesDesc: "这里是所有历史文章归档。",
      cvTitle: "简历",
      cvDesc: "我的背景、经历和当前方向的简要概览。",
      aboutTitle: "关于",
      tagPrefix: "标签：",
      tagDesc: tagName => `所有包含标签“${tagName}”的文章。`,
      prev: "上一页",
      next: "下一页",
      previousPost: "上一篇",
      nextPost: "下一篇",
      shareSummary: "三种入口共享同一个 gateway，而不是维护三套独立集成。",
    },
    footer: {
      copyright: "保留所有权利。",
    },
  },
};

export function getLocaleFromPath(pathname: string): Locale {
  return pathname.startsWith("/cn") ? "cn" : DEFAULT_LOCALE;
}

export function stripLocaleFromPath(pathname: string): string {
  if (pathname === "/cn" || pathname === "/cn/") return "/";
  return pathname.replace(/^\/cn(?=\/|$)/, "") || "/";
}

export function localizePath(pathname: string, locale: Locale): string {
  const stripped = stripLocaleFromPath(pathname);
  if (locale === DEFAULT_LOCALE) return stripped;
  return stripped === "/" ? `/${locale}/` : `/${locale}${stripped}`;
}

export function t(locale: Locale) {
  return DICTIONARY[locale];
}
