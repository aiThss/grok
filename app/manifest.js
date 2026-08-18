export default function manifest() {
  return {
    name: "Grok Pocket",
    short_name: "Grok Pocket",
    description: "Your private Grok workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
