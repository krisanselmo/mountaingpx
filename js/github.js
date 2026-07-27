/*
 * github.js — derive the GitHub repository URL from the deployment host.
 * A GitHub Pages site lives at https://<owner>.github.io/<repo>/ (or at the
 * domain root for a repository named <owner>.github.io), so the repository
 * link can be computed from any page URL: forks get a correct "source code"
 * link without any configuration.
 */

/**
 * Return the https://github.com/<owner>/<repo> URL for the first candidate
 * href hosted on GitHub Pages, or null when none matches (custom domain,
 * plain dev server…). Page files at the domain root (e.g. /en.html) belong
 * to an <owner>.github.io repository, not to a repository named after them.
 */
export function repoUrlFrom(hrefs) {
  for (const href of hrefs) {
    const m = /^https:\/\/([\w-]+)\.github\.io\/([\w.-]*)/.exec(href || '');
    if (!m) continue;
    const owner = m[1];
    const repo = m[2] && !/\.[a-z0-9]+$/i.test(m[2]) ? m[2] : `${owner}.github.io`;
    return `https://github.com/${owner}/${repo}`;
  }
  return null;
}
