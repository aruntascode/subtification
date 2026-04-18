export type Category =
  | 'entertainment'
  | 'music'
  | 'gaming'
  | 'news'
  | 'finance'
  | 'shopping'
  | 'productivity'
  | 'cloud'
  | 'developer'
  | 'design'
  | 'health'
  | 'fitness'
  | 'food'
  | 'travel'
  | 'education'
  | 'social'
  | 'security'
  | 'other';

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly';

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'entertainment', label: 'Entertainment', color: '#7c4dff' },
  { id: 'music',         label: 'Music',         color: '#1DB954' },
  { id: 'gaming',        label: 'Gaming',        color: '#FF6B00' },
  { id: 'news',          label: 'News',          color: '#1565C0' },
  { id: 'finance',       label: 'Finance',       color: '#00551f' },
  { id: 'shopping',      label: 'Shopping',      color: '#E91E63' },
  { id: 'productivity',  label: 'Productivity',  color: '#1a4593' },
  { id: 'cloud',         label: 'Cloud',         color: '#0288D1' },
  { id: 'developer',     label: 'Developer',     color: '#37474F' },
  { id: 'design',        label: 'Design',        color: '#FF0000' },
  { id: 'health',        label: 'Health',        color: '#ba1a1a' },
  { id: 'fitness',       label: 'Fitness',       color: '#FF6B35' },
  { id: 'food',          label: 'Food',          color: '#F4511E' },
  { id: 'travel',        label: 'Travel',        color: '#00796B' },
  { id: 'education',     label: 'Education',     color: '#632ce5' },
  { id: 'social',        label: 'Social',        color: '#1877F2' },
  { id: 'security',      label: 'Security',      color: '#455A64' },
  { id: 'other',         label: 'Other',         color: '#434651' },
];

export const BILLING_CYCLES: { id: BillingCycle; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'quarterly', label: 'Quarterly' },
];

export const POPULAR_SERVICES: {
  name: string;
  emoji: string;
  color: string;
  category: Category;
  defaultAmount: number;
  defaultCycle: BillingCycle;
}[] = [
  { name: 'Netflix', emoji: '🎬', color: '#E50914', category: 'entertainment', defaultAmount: 15.49, defaultCycle: 'monthly' },
  { name: 'Spotify', emoji: '🎵', color: '#1DB954', category: 'entertainment', defaultAmount: 10.99, defaultCycle: 'monthly' },
  { name: 'YouTube Premium', emoji: '📺', color: '#FF0000', category: 'entertainment', defaultAmount: 13.99, defaultCycle: 'monthly' },
  { name: 'Disney+', emoji: '🏰', color: '#1a4593', category: 'entertainment', defaultAmount: 13.99, defaultCycle: 'monthly' },
  { name: 'Apple Music', emoji: '🎧', color: '#FC3C44', category: 'entertainment', defaultAmount: 10.99, defaultCycle: 'monthly' },
  { name: 'Amazon Prime', emoji: '📦', color: '#FF9900', category: 'other', defaultAmount: 14.99, defaultCycle: 'monthly' },
  { name: 'HBO Max', emoji: '🎭', color: '#5822B4', category: 'entertainment', defaultAmount: 15.99, defaultCycle: 'monthly' },
  { name: 'iCloud+', emoji: '☁️', color: '#3693F3', category: 'productivity', defaultAmount: 2.99, defaultCycle: 'monthly' },
  { name: 'Dropbox', emoji: '💾', color: '#0061FF', category: 'productivity', defaultAmount: 11.99, defaultCycle: 'monthly' },
  { name: 'Adobe CC', emoji: '🎨', color: '#FF0000', category: 'productivity', defaultAmount: 54.99, defaultCycle: 'monthly' },
  { name: 'ChatGPT Plus', emoji: '🤖', color: '#10A37F', category: 'productivity', defaultAmount: 20.00, defaultCycle: 'monthly' },
  { name: 'Notion', emoji: '📝', color: '#000000', category: 'productivity', defaultAmount: 10.00, defaultCycle: 'monthly' },
  { name: 'Gym', emoji: '💪', color: '#FF6B35', category: 'health', defaultAmount: 29.99, defaultCycle: 'monthly' },
  { name: 'Headspace', emoji: '🧘', color: '#F47D31', category: 'health', defaultAmount: 12.99, defaultCycle: 'monthly' },
  { name: 'Duolingo', emoji: '🦉', color: '#58CC02', category: 'education', defaultAmount: 6.99, defaultCycle: 'monthly' },
];
