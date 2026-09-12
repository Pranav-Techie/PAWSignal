import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Menu, X } from "lucide-react";

function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { name: "Home", path: "/" },
    { name: "Report Animal", path: "/report" },
    { name: "Dashboard", path: "/dashboard" },
    { name: "Map", path: "/map" },
    { name: "Analytics", path: "/analytics" },
  ];

  const handleNavigation = () => {
    setMenuOpen(false);
  };

  return (
    <header className="navbar">

      {/* BRAND */}
      <Link
        to="/"
        className="brand"
        onClick={handleNavigation}
      >
        <div className="brand-icon">
          <ShieldCheck size={22} />
        </div>

        <div className="brand-text">
          <div className="brand-name">PAWSignal</div>
          <div className="brand-tagline">
            Animal Rescue Intelligence
          </div>
        </div>
      </Link>


      {/* DESKTOP NAVIGATION */}
      <nav className="desktop-nav">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={
              location.pathname === link.path
                ? "nav-link active"
                : "nav-link"
            }
          >
            {link.name}
          </Link>
        ))}
      </nav>


      {/* DESKTOP REPORT BUTTON */}
      <Link
        to="/report"
        className="nav-report"
      >
        Report Animal
      </Link>


      {/* MOBILE MENU BUTTON */}
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <X size={25} />
        ) : (
          <Menu size={25} />
        )}
      </button>


      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="mobile-nav">

          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={handleNavigation}
              className={
                location.pathname === link.path
                  ? "mobile-nav-link active"
                  : "mobile-nav-link"
              }
            >
              {link.name}
            </Link>
          ))}

          <Link
            to="/report"
            onClick={handleNavigation}
            className="mobile-report-button"
          >
            Report Animal
          </Link>

        </div>
      )}

    </header>
  );
}

export default Navbar;