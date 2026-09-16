import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export function Layout({ children }) {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/oauth/callback'].some((path) =>
    location.pathname.startsWith(path)
  );
  const isTutorPage = location.pathname.startsWith('/tutor');
  const isGroupsPage = location.pathname.startsWith('/groups');

  let mainClass = 'app-main';
  let containerClass = 'app-container';

  if (isAuthPage) {
    mainClass = 'auth-main';
    containerClass = 'auth-container';
  } else if (isTutorPage) {
    mainClass = 'app-main full-height-main';
    containerClass = 'app-container full-height-container';
  } else if (isGroupsPage) {
    mainClass = 'app-main groups-page-main';
    containerClass = 'app-container groups-page-container';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {!isAuthPage && <Navbar />}
      <main className={mainClass}>
        <div className={containerClass}>
          {children}
        </div>
      </main>
      {!isAuthPage && !isTutorPage && !isGroupsPage && <BottomNav />}
    </div>
  );
}

export default Layout;
