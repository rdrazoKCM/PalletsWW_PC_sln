import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CockpitHeader } from './CockpitHeader';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isCaptura = location.pathname === '/';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar fijo a la izquierda */}
      <Sidebar />

      {/* Área principal de trabajo con scroll propio */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
        <div className="p-3 sm:p-4 max-w-[1700px] w-full mx-auto">
          {isCaptura && <CockpitHeader />}
          <Outlet />
        </div>
      </main>
    </div>
  );
};
