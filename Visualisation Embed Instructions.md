# Visualisation Embed Instructions

This guide provides clients and developers with step-by-step instructions on how to embed and deploy the interactive visualizations (both the **Timeline** and **Infrastructure Tech Stack** diagrams) into an existing website, blog post, or CMS platform (such as WordPress, Webflow, Squarespace, Shopify, or Wix).

---

## 1. Timeline Visualisation

This visualization maps out the chronological timeline of events mapping the storyline of an AI influencer and its creator.

*   **GitHub Repository**: [GitHub - Boom-Timeline-Visualisation](https://github.com/strangerobot/Boom-Timeline-Visualisation)
*   **Example Server**: [Timeline Live Visualisation](https://timeline-visualisation.yatharthswebsite.workers.dev/)
*   **Compiled Standalone HTML**: [timeline_visualisation_package.html](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/timeline_visualisation_package.html)
*   **Suggested Embed Height**: `750px`

### Embedding Options

#### Option A: Embed using the Live Example URL
Copy and paste this HTML snippet into your website's custom HTML editor:

```html
<iframe 
  src="https://timeline-visualisation.yatharthswebsite.workers.dev/" 
  style="width: 100%; height: 750px; border: none; display: block; overflow: hidden;" 
  scrolling="no" 
  allow="fullscreen" 
  allowfullscreen
  title="AI Influencer Timeline Visualisation">
</iframe>
```

#### Option B: Host the Compiled Standalone HTML
1. Locate `timeline_visualisation_package.html` in the root of the Timeline project (or compile it fresh by running `node bundle.js`).
2. Upload the file to your web server, media library, or cloud storage bucket (e.g. AWS S3, Cloudflare Pages, Netlify).
3. Embed the uploaded file:

```html
<iframe 
  src="https://yourdomain.com/path/to/timeline_visualisation_package.html" 
  style="width: 100%; height: 750px; border: none; display: block; overflow: hidden;" 
  scrolling="no" 
  allow="fullscreen" 
  allowfullscreen
  title="AI Influencer Timeline Visualisation">
</iframe>
```

---

## 2. Infrastructure Visualisation

This diagram showcases the layer-based technology categorization, tools, and interactive scenario pathways of generative AI application workflows.

*   **GitHub Repository**: [GitHub - Infrastructures-Visualisation](https://github.com/strangerobot/Infrastructures-Visualisation)
*   **Example Server**: [AI Infrastructure Live Visualisation](https://boom-infrastructures-visualisation.yatharthswebsite.workers.dev/)
*   **Compiled Standalone HTML**: `infrastructure_visualisation_package.html`
*   **Suggested Embed Height**: `900px`

### Embedding Options

#### Option A: Embed using the Live Example URL
Copy and paste this HTML snippet into your website's custom HTML editor:

```html
<iframe 
  src="https://boom-infrastructures-visualisation.yatharthswebsite.workers.dev/" 
  style="width: 100%; height: 900px; border: none; padding: 0; display: block; overflow: hidden;" 
  scrolling="no"
  allow="fullscreen" 
  allowfullscreen 
  title="AI Infrastructure Tech Stack Visualisation">
</iframe>
```

#### Option B: Host the Compiled Standalone HTML
1. Locate the compiled `infrastructure_visualisation_package.html` inside the root of the Infrastructure project (compiled by running `node bundle.js` in that folder).
2. Upload the file to your web server, media library, or cloud storage.
3. Reference the hosted file in an iframe:

```html
<iframe 
  src="https://yourdomain.com/path/to/infrastructure_visualisation_package.html" 
  style="width: 100%; height: 900px; border: none; padding: 0; display: block; overflow: hidden;" 
  scrolling="no"
  allow="fullscreen" 
  allowfullscreen 
  title="AI Infrastructure Tech Stack Visualisation">
</iframe>
```

---

## 3. Best Practices for Responsive Integrations

To ensure a seamless user experience on both desktop and mobile devices:

*   **Width**: Always set width to `100%`. The visualizations are built responsively to adapt dynamically to the width of the parent container.
*   **Scrolling Lock**: Set `scrolling="no"` in the iframe tags. The timeline is equipped with modern touch-action direction locks, allowing users to scroll past the iframe vertically on mobile screens without getting stuck, while horizontal swipe motions are dedicated exclusively to navigating the visualization canvas.
*   **Fullscreen Mode**: Keep the `allow="fullscreen" allowfullscreen` parameters present on your iframe. This enables the built-in fullscreen zoom control toggle on the top-right header, allowing users on smaller devices to expand the timeline into a fully immersive view.
