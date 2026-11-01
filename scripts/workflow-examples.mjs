// Worked examples of GISMap Online's other two workflows, guided tours and
// field tasks, as data for the /examples/tours/ and /examples/field-tasks/
// pages. Each link here was opened in the app and checked (every tour chapter's
// view; the task's features, check-in and report); the committed files beside
// each page are what the pages offer, and tests/workflow-examples.test.mjs
// decodes them.

const BALLPARKS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Major_League_Baseball_Stadiums/FeatureServer/0";

export const WORKFLOW_EXAMPLES = Object.freeze([
  {
    slug: "classic-ballparks",
    section: "tours",
    kind: "Guided tour",
    title: "A guided tour of eight classic ballparks",
    short: "Eight classic ballparks tour",
    eyebrow: "Guided tour · 3D · tour-only link",
    openLabel: "Play the tour",
    description: "A guided tour that flies the 3D map from Fenway Park to Petco Park, with a caption at each of eight ballparks, opened from one link or QR code.",
    intro: "A guided tour moves the 3D map from place to place, with a title and a short caption at each stop, and can run by itself. This one visits eight of the oldest and most admired Major League ballparks, from Fenway Park (1912) to Petco Park (2004), tilted over satellite imagery. The whole tour is in the link.",
    shows: [
      "Chapters with their own camera: place, zoom, tilt and heading",
      "Press Play and it runs by itself, pausing six seconds at each ballpark; Back and Next work at any time",
      "A tour-only link that hides the rest of the app, for kiosks and embedding",
      "A QR code that plays the same tour on a phone",
    ],
    links: [{ label: "Tour link", file: "link.txt", qr: { file: "qr.png", caption: "Scan to play the tour on a phone." } }],
    make: {
      heading: "Make it by hand",
      steps: [
        "Open Workflows, then Tours mode.",
        "Fly to the first ballpark, tilt the view, and choose Add another chapter. Give the chapter a title and a short caption.",
        "Repeat for each stop, then set the tour to play automatically.",
        "Choose Share tour, and pick the tour-only link for a clean, full-screen tour.",
      ],
    },
    generate: {
      heading: "Or generate it",
      intro: "Tours can be made from the features you already have, so the chapters come with their places filled in:",
      steps: [
        "From a briefing: add the Major League Baseball Stadiums layer, open Briefing, include the ballparks you want, choose Add included features as slides, then Make a guided tour from these slides. Each slide becomes a chapter at its feature; adjust each chapter's tilt and caption.",
        "From a field task: a task's Tour button turns its places and features into chapters.",
      ],
    },
    agent: {
      heading: "For an AI agent",
      intro: "The tour link is base64url-encoded JSON after #tour=, so an agent can write it directly. Captions are kept to 80 characters, and the link must stay within 2,800 characters to fit a QR code.",
      lang: "js",
      code: `const tour = {
  v: 1, title: "Eight classic ballparks", skin: "clean-light", play: "auto",
  chapters: [
    { name: "Fenway Park", caption: "Boston Red Sox · opened 1912, the oldest ballpark in the majors",
      lat: 42.34622, lon: -71.09771, zoom: 16.6, tilt: 55, heading: 40, basemap: "satellite", linger: 6 },
    // … one object per stop (at most 50)
  ],
};
const base64url = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
const link = \`https://gismap.online/?tourOnly=1#tour=\${base64url(JSON.stringify(tour))}\`;`,
    },
    caveats: [
      "A tour moves the camera only; it does not carry data layers. For data with slides, use a briefing.",
      "Add &autoplay=1 to the link to start playing as soon as it opens (not when the device asks for reduced motion).",
      "Ballpark coordinates come from the Major League Baseball Stadiums layer.",
    ],
    sources: [{ label: "Major League Baseball Stadiums", url: BALLPARKS }],
  },
  {
    slug: "opening-day-wayfinding",
    section: "field-tasks",
    kind: "Field task",
    title: "A field task and its report, sent as two links",
    short: "Opening-day wayfinding check",
    eyebrow: "Field task · assignment and report links",
    openLabel: "Open the task",
    description: "A two-ballpark field check sent as a link or QR code, and the completed report that comes back the same way: check-in, steps, features and notes, with no server.",
    intro: "A field task sends someone to places on the map with instructions and a checklist. The assignment travels as a link or QR code. In the field, they check in, tick off steps and places, write what they found, and send back a report link. No account, server or app install is needed on either side.",
    shows: [
      "Features from a public layer (two ballparks, by object ID) to visit and mark done",
      "Steps to tick off, and notes for the person doing the work",
      "Check-in: where and when the visit happened, with GPS accuracy",
      "The report link back: steps done, places visited, notes, who and when",
    ],
    links: [
      { label: "Assignment link", file: "assignment.txt", qr: { file: "assignment-qr.png", caption: "Scan to open the task in the field." } },
      { label: "Completed report (sample)", file: "report.txt", qr: { file: "report-qr.png", caption: "Scan to read the sample report." } },
    ],
    make: {
      heading: "Make it by hand",
      steps: [
        "Open Workflows, then Field tasks, and choose + New field task.",
        "Write the title, instructions and steps. Choose Attach a feature from the map for each place to visit (up to five).",
        "Choose Share to send the link or show its QR code.",
        "The person in the field opens it, checks in, ticks off steps and places, writes a report and sends the link back. Opening that link shows the report.",
      ],
    },
    generate: {
      heading: "Or generate it",
      intro: "Field tasks can come out of the work you have already done:",
      steps: [
        "From a briefing: an Actions slide's next steps become a field task with Send these as a field task.",
        "And back again: a task's Briefing and Tour buttons turn its features into a briefing or a tour.",
      ],
    },
    caveats: [
      "Everything is in the link, so anyone with it can read it: keep private details out of tasks and reports.",
      "A task holds up to 5 features, 10 steps and 500 characters of notes, so its link fits a QR code.",
      "The report here is a sample, written for this example; the app shows its times in your time zone.",
    ],
    sources: [{ label: "Major League Baseball Stadiums", url: BALLPARKS }],
  },
]);

export const workflowExamplePath = (example) => `/examples/${example.section}/${example.slug}/`;

/** Every committed link, as { "<slug>/<file>": url }. */
export async function workflowExampleLinks(readText) {
  const links = {};
  for (const example of WORKFLOW_EXAMPLES) {
    for (const link of example.links) links[`${example.slug}/${link.file}`] = (await readText(`${workflowExamplePath(example).slice(1)}${link.file}`)).trim();
  }
  return links;
}

export function workflowExamplesMarkdown(links) {
  return WORKFLOW_EXAMPLES.map((example) => [
    `### ${example.title}`,
    `${example.kind}. ${example.description}`,
    example.links.map((item) => `${item.label}: ${links[`${example.slug}/${item.file}`]}`).join("\n\n"),
    `Page: https://gismap.online${workflowExamplePath(example)}`,
    `${example.make.heading}:\n\n${example.make.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
    `${example.generate.heading}: ${example.generate.intro}\n\n${example.generate.steps.map((step) => `- ${step}`).join("\n")}`,
    example.agent ? `${example.agent.heading}: ${example.agent.intro}\n\n\`\`\`${example.agent.lang}\n${example.agent.code}\n\`\`\`` : "",
    `Caveats:\n\n${example.caveats.map((item) => `- ${item}`).join("\n")}`,
  ].filter(Boolean).join("\n\n")).join("\n\n");
}
