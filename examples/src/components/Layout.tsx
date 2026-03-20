import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Components",
    items: [
      { path: "/react-pdf-viewer", label: "ReactPDFViewer" },
      { path: "/wrapper-parity", label: "Wrapper Parity" },
      { path: "/pending-review-parity", label: "Pending Review Parity" },
      { path: "/viewer-variants", label: "Viewer Variants" },
    ],
  },
  {
    title: "Features",
    items: [
      { path: "/search", label: "Search & Find" },
      { path: "/highlighting", label: "Highlighting" },
      { path: "/interactive", label: "Interactive Coordinates" },
      { path: "/viewport", label: "Viewport Management" },
    ],
  },
  {
    title: "Integrations",
    items: [{ path: "/azure-integration", label: "Azure Document Intelligence" }],
  },
  {
    title: "Advanced",
    items: [{ path: "/performance", label: "Performance Testing" }],
  },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>@dvvebond/core</h1>
          <span className="subtitle">Examples & Documentation</span>
        </div>
        <nav className="sidebar-nav">
          {navigation.map(section => (
            <div key={section.title} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
