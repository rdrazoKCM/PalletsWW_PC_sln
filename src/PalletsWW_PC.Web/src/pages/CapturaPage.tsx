import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Settings } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';
import { ValesTables } from '../components/vales/ValesTables';
import { ValeCockpitCard } from '../components/vales/ValeCockpitCard';
import { PalletsTable } from '../components/pallets/PalletsTable';
import { ModalNuevoVale } from '../components/vales/ModalNuevoVale';
import { ModalModificarVale } from '../components/vales/ModalModificarVale';
import { AlertaPalletBanner } from '../components/alertas/AlertaPalletBanner';
import { alertasService, type AlertaPallet } from '../services/alertasService';
import { APP_CONFIG } from '../config';

export const CapturaPage: React.FC = () => {
  const { 
    maquinaId, 
    valeSeleccionado, 
    esTurnoAnterior,
    encabezado,
    noEmpleado
  } = useProduction();

  const [modalNuevoValeOpen, setModalNuevoValeOpen] = useState<boolean>(false);
  const [modalModificarValeOpen, setModalModificarValeOpen] = useState<boolean>(false);
  const [alertas, setAlertas] = useState<AlertaPallet[]>([]);

  // Sincronización híbrida de alertas en tiempo real (SignalR + Hidratación)
  useEffect(() => {
    if (APP_CONFIG.alertasHabilitadas && maquinaId > 0) {
      alertasService.iniciarConexion(maquinaId);
      const desuscribir = alertasService.suscribir(setAlertas);
      return () => {
        desuscribir();
      };
    }
  }, [maquinaId]);

  const handleIrACaptura = () => {
    // Buscar la caja de texto de cajas o tarimas y enfocarla
    const inputCajas = document.querySelector('input[type="number"]') as HTMLInputElement;
    if (inputCajas) {
      inputCajas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputCajas.focus();
    }
  };

  return (
    <div className="space-y-3">
      {/* ALERTA URGENTE DE ALMACÉN: PALLET SIN ETIQUETA EN RECEPCIÓN PT (Si el módulo está habilitado) */}
      {APP_CONFIG.alertasHabilitadas && (
        <AlertaPalletBanner
          alertas={alertas}
          noEmpOperador={noEmpleado}
          onCapturarClick={handleIrACaptura}
        />
      )}
      {/* ALERTA 1: MÁQUINA NO ASIGNADA A ESTA TERMINAL */}
      {maquinaId <= 0 && (
        <div className="p-4 rounded-xl border-l-6 border-red-600 bg-red-50 text-red-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-red-800">
                ¡ATENCIÓN: TERMINAL NO ASIGNADA A NINGUNA MÁQUINA!
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Esta computadora aún no tiene configurada su línea de producción. Por seguridad industrial, la captura de tarimas está bloqueada para evitar registrar información en una línea equivocada.
              </p>
            </div>
          </div>
          <Link
            to="/configuracion"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span>Asignar Máquina</span>
          </Link>
        </div>
      )}

      {/* ALERTA 2: SIN ENCABEZADO DE TURNO ACTIVO */}
      {maquinaId > 0 && encabezado && !encabezado.encontrado && (
        <div className="p-3.5 rounded-xl border-l-4 border-amber-500 bg-amber-50 text-amber-900 text-xs shadow-2xs flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Aviso de Turno:</strong> No se encontró un encabezado de turno dado de alta para esta máquina en la fecha actual. Comuníquese con el supervisor de producción para registrar la apertura del turno.
          </div>
        </div>
      )}

      {/* TABLAS COMPARATIVAS DE VALES (TURNO ACTUAL Y TURNO ANTERIOR) CON BOTONES ULTRA PRO */}
      <ValesTables 
        onOpenNuevoVale={() => setModalNuevoValeOpen(true)}
        onOpenModificarVale={() => setModalModificarValeOpen(true)}
      />

      {/* BANNER DE ADVERTENCIA PROMINENTE: CAPTURANDO EN TURNO ANTERIOR */}
      {esTurnoAnterior && valeSeleccionado && (
        <div className="p-3 rounded-xl border-2 border-amber-500 bg-amber-100/90 text-amber-950 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <strong className="text-xs uppercase tracking-wide block font-extrabold text-amber-900">
                ⚠️ ATENCIÓN: CAPTURANDO EN EL TURNO ANTERIOR
              </strong>
              <span className="text-xs text-amber-800">
                El vale <strong>{valeSeleccionado.folioVale}</strong> pertenece al turno anterior. Las tarimas registradas se asociarán a dicho turno.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-mono text-xs font-bold shrink-0">
            TURNO ANTERIOR
          </span>
        </div>
      )}

      {/* ─── CONTENEDOR SPLIT: TARJETA DE DETALLE A LA IZQUIERDA Y LISTADO DE PALLETS A LA DERECHA ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch mb-6">
        {/* Columna Izquierda (25% - lg:col-span-3): Tarjeta Cockpit Zafiro & Cyan Neón Plus */}
        <div className="lg:col-span-3">
          <ValeCockpitCard />
        </div>

        {/* Columna Derecha (75% - lg:col-span-9): Cuadrícula de Tarimas Capturadas y Fila de Captura */}
        <div className="lg:col-span-9">
          <PalletsTable
            onOpenNuevoVale={() => setModalNuevoValeOpen(true)}
          />
        </div>
      </div>

      {/* MODALES */}
      <ModalNuevoVale
        isOpen={modalNuevoValeOpen}
        onClose={() => setModalNuevoValeOpen(false)}
      />

      <ModalModificarVale
        isOpen={modalModificarValeOpen}
        onClose={() => setModalModificarValeOpen(false)}
      />
    </div>
  );
};
