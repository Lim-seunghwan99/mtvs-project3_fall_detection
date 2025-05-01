// src/components/NavigationBar/NavigationBar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './NavigationBar.css';

function NavigationBar() {
  return (
    <nav className="navbar">
      <div className="navbar-content"> {/* 콘텐츠 래퍼 */}
        <ul className="nav-links">
          <li><Link to="/">실시간 감지</Link></li>
          <li><Link to="/lookup">기록 조회</Link></li>
        </ul>
      </div>
    </nav>
  );
}

export default NavigationBar;