import type { BrandSocialLink } from '@/lib/brands';
import './brand-social-links.css';

export function BrandSocialLinks({
  links = [],
}: {
  links?: BrandSocialLink[];
}) {
  if (!links.length) return null;
  return (
    <nav className="brand-social-links" aria-label="Social media">
      {links.map(({ label, url }) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer">
          {label}
          <span className="brand-social-new-tab"> (opens in a new tab)</span>
        </a>
      ))}
    </nav>
  );
}
