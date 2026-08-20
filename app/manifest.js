export default function manifest() {
  return {
    name: "Grok Pocket",
    short_name: "Grok Pocket",
    description: "Private Grok-style AI chat with image and GitHub tools.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
