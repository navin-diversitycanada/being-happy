// Temporary mock data used by pages before a database is connected.
// Copy this file to src/data/mockData.js

export const articles = [
  { id: "1", title: "Benefits of Meditation", img: "/images/4.jpg", excerpt: "Short intro to benefits of a regular meditation practice.", content: "<h2>Introduction</h2><p>Meditation improves focus and reduces stress.</p>" , categories: ["How-to"]},
  { id: "2", title: "How to Practice Mindfulness", img: "/images/5.jpg", excerpt: "Simple steps for bringing mindfulness into daily life.", content: "<h2>Steps</h2><ul><li>Start small</li><li>Breathe</li></ul>", categories: ["How-to"]},
  { id: "3", title: "Building Resilience: Evidence‑based Approaches", img: "/images/1.jpg", excerpt: "Research-backed strategies for long term resilience.", content: "<h2>Research</h2><p>Studies show...</p>", categories: ["Research"]},
  { id: "4", title: "The Science of Happiness", img: "/images/6.jpg", excerpt: "Overview of research in positive psychology.", content: "<h2>Science</h2><p>Happiness is complex.</p>", categories: ["Research"]},
];

export const audios = [
  { id: "1", title: "5 Steps to Happiness", img: "/images/1.jpg", length: "10:00", desc: "A short guided practice for well-being.", embed: "" },
  { id: "2", title: "Mindful Breathing", img: "/images/2.jpg", length: "8:30", desc: "Breathing exercise to calm the mind.", embed: "" },
  { id: "3", title: "Evening Calm", img: "/images/3.jpg", length: "12:00", desc: "Wind-down audio for bedtime.", embed: "" },
];

export const videos = [
  { id: "1", title: "Introduction to Mindfulness", img: "/images/5.jpg", youtube: "9T8A89jgeTI", desc: "Short video intro." },
  { id: "2", title: "Joyful Moments", img: "/images/4.jpg", youtube: "9T8A89jgeTI", desc: "Highlights to brighten your day." },
];

export const directories = [
  { id: "1", title: "Crisis Services Canada", tags: ["Website","Canada","Mental Health"], desc: "A safe space to talk, 24/7.", link: "https://988.ca/" },
  { id: "2", title: "Kids Help Phone", tags: ["Website","Canada","Youth"], desc: "Support for young people.", link: "https://kidshelpphone.ca/" },
];

export const featured = [
  { type: "audio", id: "2" },
  { type: "video", id: "2" },
  { type: "article", id: "3" }
];

export function findArticle(id) {
  return articles.find(a => a.id === String(id));
}
export function findAudio(id) {
  return audios.find(a => a.id === String(id));
}
export function findVideo(id) {
  return videos.find(v => v.id === String(id));
}
export function findDirectory(id) {
  return directories.find(d => d.id === String(id));
}