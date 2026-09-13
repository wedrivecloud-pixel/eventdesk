'use client';
import { useState, type MouseEvent } from 'react';
import { AppLogo } from '@/components/app-logo';
import {
  House,
  CalendarDays,
  SquareCheck,
  MessageSquare,
  Users,
  FileText,
  Package,
  Wallet,
  ChartNoAxesColumnIncreasing,
  Link as LinkIcon,
  Settings,
  ChevronDown,
  CircleHelp,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  workspaceGroups,
  workspaceHref,
  navigationParent,
  contextualLinks,
  scopeLinks,
  type NavigationItem,
} from '@/lib/workspace-navigation';

const icons: Record<string, LucideIcon> = {
  home: House,
  calendar: CalendarDays,
  tasks: SquareCheck,
  messages: MessageSquare,
  users: Users,
  file: FileText,
  package: Package,
  wallet: Wallet,
  reports: ChartNoAxesColumnIncreasing,
  link: LinkIcon,
  settings: Settings,
};
export function localNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  view: string,
  navigate: (s: string) => void,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  navigate(view);
}
export function WorkspaceNavigation({
  view,
  business,
  leads,
  onNavigate,
}: {
  view: string;
  business: string;
  leads: number;
  onNavigate: (s: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const parent = navigationParent(view);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [collapsedView, setCollapsedView] = useState('');
  function navigate(next: string) {
    setOpenMobile(false);
    onNavigate(next);
  }
  function itemLink(item: { label: string; view: string }, nested = false) {
    const selected = item.view === view || (!nested && parent === item.label);
    return (
      <a
        className={
          'workspace-nav-link' + (nested ? ' workspace-nav-child' : '')
        }
        href={workspaceHref(item.view)}
        onClick={(e) => localNavigation(e, item.view, navigate)}
        aria-current={selected ? 'page' : undefined}
      >
        {!nested &&
          (() => {
            const found = workspaceGroups
              .flatMap((g) => g.items)
              .find((i) => i.view === item.view);
            const Icon = icons[found?.icon || 'file'];
            return <Icon size={19} aria-hidden="true" />;
          })()}
        <span>{item.label}</span>
        {item.view === 'Leads' && leads > 0 && (
          <span className="workspace-nav-badge">{leads}</span>
        )}
      </a>
    );
  }
  function itemRow(item: NavigationItem) {
    if (item.view)
      return (
        <li key={item.label}>
          {itemLink({ label: item.label, view: item.view })}
        </li>
      );
    const Icon = icons[item.icon],
      open =
        expanded.includes(item.label) ||
        (parent === item.label && collapsedView !== view),
      id = 'nav-' + item.label.toLowerCase().replace(/\s/g, '-');
    return (
      <li key={item.label}>
        <button
          type="button"
          className="workspace-nav-link workspace-nav-disclosure"
          data-parent-active={parent === item.label || undefined}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (parent === item.label) setCollapsedView(open ? view : '');
            setExpanded((v) =>
              open ? v.filter((x) => x !== item.label) : [...v, item.label],
            );
          }}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{item.label}</span>
          <ChevronDown
            size={14}
            className={open ? 'rotated' : ''}
            aria-hidden="true"
          />
        </button>
        <ul id={id} hidden={!open} className="workspace-subnav">
          {item.children?.map((c) => (
            <li key={c.view}>{itemLink(c, true)}</li>
          ))}
        </ul>
      </li>
    );
  }
  return (
    <Sidebar className="crm-sidebar modern-sidebar">
      <SidebarHeader className="workspace-nav-header">
        <a
          className="workspace-brand"
          href={workspaceHref('Overview')}
          onClick={(e) => localNavigation(e, 'Overview', navigate)}
          aria-label="Eventdeskly overview"
        >
          <AppLogo className="workspace-brand-logo" />
        </a>
        {isMobile && (
          <button
            type="button"
            className="workspace-nav-close"
            aria-label="Close navigation"
            onClick={() => setOpenMobile(false)}
          >
            <X size={20} />
          </button>
        )}
        <a
          className="workspace-business"
          href={workspaceHref('Business settings')}
          onClick={(e) => localNavigation(e, 'Business settings', navigate)}
          title="Business settings"
        >
          <span>{business}</span>
          <Settings size={15} aria-hidden="true" />
        </a>
      </SidebarHeader>
      <SidebarContent>
        <nav className="workspace-navigation" aria-label="Main navigation">
          {workspaceGroups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2>{group.label}</h2>
              <ul>{group.items.map(itemRow)}</ul>
            </section>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="workspace-nav-footer">
        <a
          className="workspace-nav-link"
          href={workspaceHref('Support')}
          onClick={(e) => localNavigation(e, 'Support', navigate)}
          aria-current={view === 'Support' ? 'page' : undefined}
        >
          <CircleHelp size={19} aria-hidden="true" />
          <span>Help & support</span>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
export function WorkspaceContextNavigation({
  view,
  onNavigate,
}: {
  view: string;
  onNavigate: (s: string) => void;
}) {
  const links = contextualLinks(view),
    scopes = scopeLinks(view);
  const link = (item: { label: string; view: string }, section = false) => (
    <a
      key={item.view}
      href={workspaceHref(item.view)}
      onClick={(e) => localNavigation(e, item.view, onNavigate)}
      aria-current={
        item.view === view ||
        (section &&
          ((item.view === 'Calendar' && view === 'My Calendar') ||
            (item.view === 'Appointments' && view === 'My Appointments')))
          ? 'page'
          : undefined
      }
    >
      {item.label}
    </a>
  );
  if (!links.length && !scopes.length) return null;
  return (
    <div className="workspace-context-navigation">
      {links.length > 0 && (
        <nav
          aria-label="Section navigation"
          className="workspace-context-links"
        >
          {links.map((item) => link(item, true))}
        </nav>
      )}
      {scopes.length > 0 && (
        <nav aria-label="Record scope" className="workspace-scope-links">
          {scopes.map((item) => link(item))}
        </nav>
      )}
    </div>
  );
}
