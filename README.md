# Timeline of an AI Influencer

An interactive, premium merging timeline visualization mapping the storyline of an AI influencer (`Babydoll Archi`) and its creator (`Pratim Bora`). The application features chronological scaling, merging tracks, immersive CSS effects, and interactive elements.

## Table of Contents
1. [How It Works](#how-it-works)
2. [Local Development](#local-development)
3. [Modifying the Timeline](#modifying-the-timeline)
4. [Deployment & Hosting](#deployment--hosting)
5. [Embedding the Timeline](#embedding-the-timeline)

---

## How It Works

This project is built using a decoupled architecture of a simple Node.js backend and a dynamic client-side frontend:

*   **Backend (`server.js`)**: An Express server that acts as a parser and static asset provider. It reads `public/timeline.csv`, parses the data using a custom parser supporting multi-line quotes, handles chronological sorting (parsing complex dates like years, months, and string representations into numeric values), and exposes the clean JSON payload at `/api/timeline`.
*   **Frontend (`public/`)**:
    *   [index.html](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/public/index.html) - Structural framework containing navigation keys, full-screen toggle support, and viewports.
    *   [app.js](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/public/app.js) - Fetches the dataset from the API, computes horizontal coordinate placement based on event density/timeline, creates dynamically curved SVGs representing separate and merged tracks, and manages interactive card highlights.
    *   [style.css](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/public/style.css) - Contains responsive styling, dark/light themes, typography tokens, glassmorphism card designs, and focus states.

---

## Local Development

To run the application locally on your computer:

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm start
    ```
3.  **Open the application**:
    Navigate to `http://localhost:3000` in your web browser.

---

## Modifying the Timeline

All data is dynamically populated from the [timeline.csv](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/public/timeline.csv) file. You can modify this file to change metadata colors, labels, track descriptions, or list new events.

### Configurations
Lines in the CSV with `Type` set to `config` declare metadata. Supported keys:
*   `track1_label`, `track1_color` — Custom labels and color themes for Track 1 (e.g. Creator track).
*   `track2_label`, `track2_color` — Custom labels and color themes for Track 2 (e.g. AI Persona track).
*   `merged_label`, `merged_color` — The label/color for when tracks merge.
*   `merge_after_event_id`, `merge_before_event_id` — Controls which events trigger the visual merging curve.

### Events
Lines in the CSV with `Type` set to `event` represent cards on the timeline:
*   `ID`: Unique identifier of the event.
*   `Year`: Numeric or standard dates (e.g. `2018`, `2023-06`, `2025-07-12`). Used for chronological order placement.
*   `Track`: `1` (top track), `2` (bottom track), or `3` (center/tech milestones).
*   `Title`: Display title of the card.
*   `Date Label`: Readable date string shown on the card (e.g. `"Mid-2023"`, `"July 13, 2025"`).
*   `Description`: Detailed description body.

---

## Deployment & Hosting

### 1. Static Hosting (Netlify / Vercel / GitHub Pages)
Because the codebase reads from static files, you can deploy the `public` directory directly to any static web host. 
*   **Netlify**: A configuration file ([netlify.toml](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Timeline%20Visualisation/netlify.toml)) is already included. You can hook the Git repository to Netlify, set the publish directory to `public`, and deploy.

### 2. Node.js Hosting (Heroku / Render / Railway)
To deploy the dynamic backend server:
*   Make sure to configure the start script as `npm start`.
*   The application automatically binds to the `process.env.PORT` variable provided by the host environment.

---

## Embedding the Timeline

You can seamlessly embed this timeline into any external article, blog post, or webpage using the following responsive `<iframe>` code template:

```html
<iframe 
  src="https://timeline-visualisation.yatharthswebsite.workers.dev/" 
  style="width: 100%; height: 700px; border: none; display: block;" 
  scrolling="no" 
  allow="fullscreen" 
  allowfullscreen
  title="Timeline Visualisation">
</iframe>
```
