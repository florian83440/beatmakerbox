// Site-wide info displayed on Contact / Terms / Privacy / Legal pages.
// Edit these values once — every page reads from here.

export const SITE_INFO = {
  /** Contact email — shown on /contact and used in mailto: links. */
  email: 'contact@beatmakerbox.com',

  /** Publisher (LCEN — "Mentions légales"). Replace with your name / company. */
  editor: '[Your name or company — replace in lib/siteInfo.ts]',

  /** Hosting provider (LCEN). */
  hosting: 'OVH SAS — 2 rue Kellermann, 59100 Roubaix, France',

  /** Last update date displayed at the top of legal pages. */
  legalUpdated: 'May 22, 2026',
} as const
