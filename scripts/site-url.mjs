/*
 * site-url.mjs — resolve the public URL of the site, configured once.
 * Priority:
 *   1. the SITE_URL environment variable (custom domain);
 *   2. GITHUB_REPOSITORY on GitHub Actions — a fork deploys to
 *      https://<owner>.github.io/<repo>/ without any configuration;
 *   3. the "homepage" field of package.json (local builds).
 * The returned URL always ends with a slash.
 */
import { readFileSync } from 'node:fs';

export function resolveSiteUrl(env = process.env) {
  let url = env.SITE_URL;
  if (!url && env.GITHUB_REPOSITORY) {
    const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
    url = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
      ? `https://${owner}.github.io`
      : `https://${owner}.github.io/${repo}`;
  }
  if (!url) {
    url = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).homepage;
  }
  return url.endsWith('/') ? url : url + '/';
}

/** Replace the __SITE_URL__ placeholders of an HTML/XML string. */
export function injectSiteUrl(text, site) {
  return text.replaceAll('__SITE_URL__', site);
}
