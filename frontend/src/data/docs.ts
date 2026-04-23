export type DocItem = {
  id: string;
  title: string;
  description: string;
  author: string;
  date: string;
  tag: string;
  image: string;
  category: string;
  readTime: string;
};

export const docs: DocItem[] = [
  {
    id: "1",
    title: "Google OAuth 2.0 Integration",
    description: "Learn how to implement Google Login in your web application using the OAuth 2.0 protocol.",
    author: "Aarav Mehta",
    date: "Apr 22, 2026",
    tag: "Authentication",
    image: "tech_minimalist_art.png",
    category: "Authentication",
    readTime: "10 min read",
  },
  {
    id: "2",
    title: "How Access & Refresh Tokens Work",
    description: "A deep dive into token-based authentication, expiration, and silent renewal strategies.",
    author: "Riya Sharma",
    date: "Apr 21, 2026",
    tag: "Security",
    image: "abstract_architecture_clean.png",
    category: "Security",
    readTime: "8 min read",
  },
  {
    id: "3",
    title: "Firebase Cloud Messaging Setup",
    description: "Complete guide to setting up push notifications for your web and mobile users.",
    author: "Kabir Nanda",
    date: "Apr 20, 2026",
    tag: "Cloud",
    image: "nature_productivity_serene.png",
    category: "Cloud",
    readTime: "9 min read",
  },
];

export const docCategories = ["All", ...new Set(docs.map((doc) => doc.category))];
