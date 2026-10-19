import type { ReactNode } from "react";

type MarketingChromeProps = {
  children: ReactNode;
  gymAdminUrl: string;
};

type MarketingHeaderProps = {
  gymAdminUrl: string;
};

export function MarketingChrome({ children, gymAdminUrl }: MarketingChromeProps) {
  return (
    <div className="marketing-site">
      <MarketingHeader gymAdminUrl={gymAdminUrl} />
      <main>{children}</main>
      <MarketingFooter gymAdminUrl={gymAdminUrl} />
    </div>
  );
}

export function MarketingHeader({ gymAdminUrl }: MarketingHeaderProps) {
  const navigation = [
    { href: "/product", label: "Product" },
    { href: "/for-athletes", label: "For athletes" },
    { href: "/for-gyms", label: "For gyms" },
    { href: "/pricing", label: "Pricing" }
  ];

  return (
    <header className="marketing-header">
      <a className="marketing-logo" href="/" aria-label="KRUXT home">
        <img src="/icon.svg" alt="" />
        <span>KRUXT</span>
      </a>

      <nav className="marketing-desktop-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="marketing-header-actions">
        <a className="marketing-text-link" href="/#member-login">
          Sign in
        </a>
        <a className="marketing-button marketing-button-primary marketing-button-compact" href="/#member-login">
          Get started
          <ArrowIcon />
        </a>
      </div>

      <details className="marketing-mobile-menu">
        <summary aria-label="Open navigation">
          <span />
          <span />
        </summary>
        <nav aria-label="Mobile navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
          <a href="/#member-login">Member sign in</a>
          <a href={gymAdminUrl}>Gym admin sign in</a>
        </nav>
      </details>
    </header>
  );
}

export function MarketingFooter({ gymAdminUrl }: MarketingHeaderProps) {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-brand">
        <a className="marketing-logo" href="/" aria-label="KRUXT home">
          <img src="/icon.svg" alt="" />
          <span>KRUXT</span>
        </a>
        <p>Training, community, coaching, and gym operations in one connected system.</p>
      </div>

      <FooterColumn
        title="Product"
        links={[
          ["/product", "Overview"],
          ["/for-athletes", "For athletes"],
          ["/for-gyms", "For gyms"],
          ["/pricing", "Pricing"],
          ["/integrations", "Integrations"]
        ]}
      />
      <FooterColumn
        title="Company"
        links={[
          ["/contact", "Contact"],
          ["/contact#support", "Support"],
          ["/contact#gyms", "Book a walkthrough"]
        ]}
      />
      <FooterColumn
        title="Legal"
        links={[
          ["/legal/privacy", "Privacy"],
          ["/legal/terms", "Terms"],
          ["/legal/cookies", "Cookies"]
        ]}
      />
      <FooterColumn
        title="Access"
        links={[
          ["/#member-login", "Member sign in"],
          [gymAdminUrl, "Gym admin sign in"]
        ]}
      />

      <div className="marketing-footer-bottom">
        <span>&copy; {new Date().getFullYear()} KRUXT</span>
        <span>Built for people who train and the gyms that support them.</span>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <nav className="marketing-footer-column" aria-label={title}>
      <strong>{title}</strong>
      {links.map(([href, label]) => (
        <a key={`${title}-${href}`} href={href}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
