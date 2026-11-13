/* ==========================================================================
   content.ts — every word on the site lives here.
   Edit text in this file only. The components render it and the modules in
   src/motion/ animate it; nothing here touches layout or animation.
   ========================================================================== */

export interface LinkButton {
  label: string;
  /** External URL, or a path inside public/ (e.g. "assets/file.pdf"). */
  href: string;
  primary?: boolean;
  newTab?: boolean;
}

export interface Entry {
  title: string;
  detail: string;
  years?: string;
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export interface Project {
  title: string;
  /** Short stack line, e.g. "Next.js, Tailwind, Netlify". "" hides it. */
  stack: string;
  /** e.g. "2025". "" hides it. */
  year: string;
  blurb: string;
  /** Path inside public/, e.g. "assets/tshering-tours.png". "" shows a neutral placeholder frame. */
  image: string;
  /** Fill in a URL to show the link and make the card clickable; "" hides it. */
  links: { live: string; code: string };
}

export interface ProjectGroup {
  name: string;
  items: Project[];
}

export interface ContactLink {
  label: string;
  text: string;
  href: string;
}

export const content = {
  meta: {
    title: "Pema Losel Maurer, Software Engineering student",
    description:
      "Portfolio of Pema Losel Maurer (Fritzlee), a Software Engineering student in Bhutan working on web, systems and security."
  },

  hero: {
    name: "Pema Losel Maurer",
    alias: "Fritzlee",
    role: "Software Engineering student · Web, Systems & Security",
    buttons: [
      { label: "Download CV", href: "assets/Pema Losel Maurer Resume.pdf", primary: true, newTab: true },
      { label: "GitHub", href: "https://github.com/PemaLoselMaurer" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/fritzlee-maurer-613051322/" }
    ] as LinkButton[]
  },

  /**
   * The prints behind the whole page: the wave in the light theme, the
   * fireworks in the dark. Cut into depth layers by scripts/cut-layers.cjs
   * and scripts/cut-fireworks.cjs; `print` is the flat version shown without WebGL.
   */
  art: {
    print: "assets/wave/print-2000.webp",
    alt: "The Great Wave off Kanagawa: a huge wave curls over three boats, with Mount Fuji small in the distance",
    credit: "Katsushika Hokusai, Under the Wave off Kanagawa, c. 1830–32"
  },
  artDark: {
    print: "assets/night/night-print-2000.webp",
    alt: "Fireworks at Ikenohata: fireworks fall over a dark pond, paper lanterns hang on a rope, and a crowd watches in silhouette",
    credit: "Kobayashi Kiyochika, Fireworks at Ikenohata, 1881"
  },
  /** Shown after both credits in the footer. */
  artSource: "The Metropolitan Museum of Art, public domain.",

  /**
   * The story told in the passages between sections, while the camera moves
   * through the print. Read in order, it runs from the crew in the great
   * wave, to the three boats (one per client site), to Fuji.
   */
  story: {
    toEducation: "Every crew starts by learning to row.",
    toProjects: "Three boats in the print. Three sites, built for real clients.",
    toContact: "Through all of it, the mountain stays put."
  },

  /** The same story, told over the fireworks print in the dark theme. */
  storyDark: {
    toEducation: "Every festival starts with someone up a tree, hanging the lanterns.",
    toProjects: "Lanterns on the line. Three sites, built for real clients.",
    toContact: "Then everyone looks up."
  },

  about: {
    heading: "About",
    portrait: {
      src: "assets/profile.webp",
      /** Static halftone, shown without WebGL. To change the photo: `npm run halftone -- path/to/photo.jpg`. */
      halftone: "assets/profile-halftone.png",
      alt: "Pema Losel Maurer photographing the viewer with a compact camera, in front of a waterfall"
    },
    statement:
      "Third-year B.E. Software Engineering student at the College of Science and Technology, Royal University of Bhutan (2024–2028). I build web products and distributed systems, and I like breaking them on purpose."
  },

  education: {
    heading: "Education",
    items: [
      { title: "B.E. Software Engineering", detail: "College of Science and Technology", years: "2024–2028" },
      { title: "Higher Secondary (Science)", detail: "Yangchenphug HSS, Thimphu", years: "2021–2023" }
    ] as Entry[]
  },

  experience: {
    heading: "Experience",
    items: [
      {
        title: "Intern, DHI InnoTech",
        detail: "Four-month internship.",
        years: "Aug–Nov 2026"
      },
      {
        title: "Class Representative",
        detail: "B.E. Software Engineering, College of Science and Technology. Second year.",
        years: "2025–2026"
      },
      {
        title: "Freelance web developer",
        detail: "Built sites for Tshering Tours and Treks, Bhutan Herbal Tea, and Swiss Guest House (EN/DE)."
      },
      {
        title: "House Captain",
        detail: "Yangchenphug HSS. Led 150+ students.",
        years: "2023"
      }
    ] as Entry[]
  },

  skills: {
    heading: "Skills",
    groups: [
      { name: "Backend & Systems", items: ["Go", "gRPC", "Microservices", "NestJS", "Node.js", "PostgreSQL", "Docker"] },
      { name: "Frontend & Mobile", items: ["TypeScript", "JavaScript", "React", "Next.js", "Tailwind", "React Native / Expo", "HTML", "CSS"] },
      { name: "Testing & DevOps", items: ["Jest", "TDD", "Jenkins", "GitHub Actions", "CI/CD", "Git"] },
      { name: "Security", items: ["Penetration testing", "Privilege escalation", "Nmap", "OWASP Top 10", "Kali Linux", "Wireshark", "OSINT", "GPG", "TryHackMe & HTB Academy"] },
      { name: "Languages", items: ["Dzongkha (native)", "Sharchhopkha (native)", "Bumthap (native)", "English (fluent)", "German (basic)"] }
    ] as SkillGroup[]
  },

  projects: {
    heading: "Projects",
    placeholder: "Screenshot to come",
    linkLabels: { live: "Visit site", code: "View code" },
    /** Label that follows the cursor over a card that has a link. */
    hoverLabel: "View",
    groups: [
      {
        name: "Client work",
        items: [
          {
            title: "Tshering Tours and Treks",
            stack: "Next.js, Tailwind, Netlify",
            year: "",
            blurb: "Cultural journeys and Himalayan treks across Bhutan, for a tour operator based in Thimphu.",
            image: "assets/projects/tshering-tours.webp",
            links: { live: "https://tsheringtoursandtrek.netlify.app/", code: "" }
          },
          {
            title: "Bhutan Herbal Tea",
            stack: "Next.js, Tailwind, Netlify",
            year: "",
            blurb: "Organic herbal teas from Bhutan's first herbal tea farm, in Bumthang.",
            image: "assets/projects/bhutan-herbal-tea.webp",
            links: { live: "https://bhutanherbaltea.netlify.app/", code: "" }
          },
          {
            title: "Swiss Guest House",
            stack: "Next.js, Tailwind, Netlify",
            year: "",
            blurb: "Rooms, food and bookings for a guest house in Bumthang, in English and German.",
            image: "assets/projects/swiss-guest-house.webp",
            links: { live: "https://www.swissguesthouse.bt/", code: "" }
          }
        ]
      }
    ] as ProjectGroup[]
  },

  contact: {
    heading: "Contact",
    headline: "Let’s build something.",
    links: [
      { label: "Email", text: "fritzleemaurer@gmail.com", href: "mailto:fritzleemaurer@gmail.com" },
      { label: "GitHub", text: "github.com/PemaLoselMaurer", href: "https://github.com/PemaLoselMaurer" },
      { label: "LinkedIn", text: "linkedin.com/in/fritzlee-maurer", href: "https://www.linkedin.com/in/fritzlee-maurer-613051322/" }
    ] as ContactLink[]
  },

  /**
   * Easter egg. Write the line in plain text: the page shows it enciphered
   * (ROT13) until the key in the footer is clicked.
   */
  secret: {
    buttonLabel: "Decrypt the hidden line",
    text: "You found the key. I read page source for fun too, so say hello."
  },

  /** {year} is replaced with the build year. */
  colophon: "© {year} Pema Losel Maurer"
};

/** Sections in page order. Drives the nav and the numbered labels. */
export const sections = [
  { id: "about", label: content.about.heading },
  { id: "education", label: content.education.heading },
  { id: "experience", label: content.experience.heading },
  { id: "skills", label: content.skills.heading },
  { id: "projects", label: content.projects.heading },
  { id: "contact", label: content.contact.heading }
];

/** Number ("01") and title ("About") of a section, for its heading. */
export function sectionLabel(id: string): { num: string; title: string } {
  const index = sections.findIndex((s) => s.id === id);
  return { num: String(index + 1).padStart(2, "0"), title: sections[index]?.label ?? id };
}
