'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '../css/dashboard.module.css';

type Order = {
  id: string;
  customer: string;
  item: string;
  due: string;
  status: 'En producción' | 'Pendiente' | 'Listo';
  initials: string;
  color: string;
};

const initialOrders: Order[] = [
  { id: 'FS-2084', customer: 'Club Deportivo Norte', item: 'Uniforme local · 24 und.', due: 'Hoy, 4:30 p. m.', status: 'En producción', initials: 'CN', color: 'mint' },
  { id: 'FS-2083', customer: 'Academia Halcones', item: 'Camiseta entrenamiento · 18 und.', due: 'Hoy, 5:00 p. m.', status: 'Pendiente', initials: 'AH', color: 'peach' },
  { id: 'FS-2082', customer: 'Liga Barrial San José', item: 'Uniforme visitante · 36 und.', due: '30 sep, 10:00 a. m.', status: 'En producción', initials: 'LJ', color: 'lilac' },
  { id: 'FS-2081', customer: 'Escuela Fútbol 10', item: 'Uniforme infantil · 22 und.', due: '30 sep, 2:00 p. m.', status: 'Listo', initials: 'F10', color: 'yellow' },
];

const stages = [
  { name: 'Corte', count: '12 órdenes', progress: 76, color: 'green' },
  { name: 'Sublimación', count: '8 órdenes', progress: 58, color: 'orange' },
  { name: 'Confección', count: '15 órdenes', progress: 84, color: 'blue' },
  { name: 'Terminados', count: '6 órdenes', progress: 42, color: 'purple' },
];

const supplies = [
  { name: 'Tela deportiva dry fit', detail: '12 metros disponibles', amount: '12 m', percent: 18, color: 'red' },
  { name: 'Hilo poliéster blanco', detail: '8 conos disponibles', amount: '8 u', percent: 28, color: 'orange' },
  { name: 'Papel para sublimación', detail: '2 rollos disponibles', amount: '2 r', percent: 12, color: 'red' },
];

const navigation = [
  { label: 'Resumen', icon: '⌂', href: '#inicio', active: true },
  { label: 'Pedidos', icon: '▤', href: '#pedidos', badge: '8' },
  { label: 'Producción', icon: '◷', href: '#produccion' },
  { label: 'Inventario', icon: '▦', href: '#inventario', badge: '3', alert: true },
  { label: 'Reportes', icon: '▥', href: '#actividad' },
];

function formatDate() {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export default function Dashboard() {
  const orders = initialOrders;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesSearch = `${order.id} ${order.customer} ${order.item}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'Todos' || order.status === statusFilter);
  }), [orders, search, statusFilter]);

  return (
    <main className={styles.shell} id="inicio">
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/dashboard" aria-label="Frenesí Sport, resumen">
          <span className={styles.brandMark}>F</span>
          <span className={styles.brandName}>FRENESÍ <b>SPORT</b></span>
        </Link>

        <div className={styles.businessLabel}>ESPACIO DE TRABAJO</div>
        <nav className={styles.navigation} aria-label="Navegación principal">
          {navigation.map((item) => (
            <a
              aria-current={item.active ? 'page' : undefined}
              className={`${styles.navLink} ${item.active ? styles.navActive : ''}`}
              href={item.href}
              key={item.label}
            >
              <span aria-hidden="true" className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className={`${styles.navBadge} ${item.alert ? styles.navAlert : ''}`}>{item.badge}</span>}
            </a>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarHelp}>
            <span className={styles.helpIcon} aria-hidden="true">?</span>
            <div><strong>¿Necesitas ayuda?</strong><span>Contacta a soporte</span></div>
            <span aria-hidden="true">↗</span>
          </div>
          <Link className={styles.profile} href="/login">
            <span className={styles.profileAvatar}>MG</span>
            <span className={styles.profileText}><strong>María García</strong><span>Administradora</span></span>
            <span className={styles.profileMenu} aria-hidden="true">···</span>
          </Link>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>Frenesí Sport</span><span aria-hidden="true">/</span><strong>Resumen</strong></div>
          <div className={styles.topbarActions}>
            <span className={styles.today}>{formatDate()}</span>
            <button className={styles.notification} aria-label="Notificaciones">
              <span aria-hidden="true">♧</span><i />
            </button>
            <span className={styles.topAvatar} aria-label="María García">MG</span>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.welcomeRow}>
            <div>
              <div className={styles.overline}>MARTES, 29 DE SEPTIEMBRE</div>
              <h1>Buenos días, María <span aria-hidden="true">✳</span></h1>
              <p>Esto es lo que está pasando en tu operación hoy.</p>
            </div>
            <a className={styles.primaryAction} href="#pedidos"><span aria-hidden="true">＋</span> Nuevo pedido</a>
          </div>

          <div className={styles.demoNote}><span aria-hidden="true">i</span> Vista de demostración · Los indicadores aún no están conectados a datos reales.</div>

          <section className={styles.metrics} aria-label="Indicadores principales">
            <article className={styles.metricCard}>
              <div className={styles.metricTop}><span>Pedidos activos</span><span className={`${styles.metricIcon} ${styles.iconMint}`} aria-hidden="true">▤</span></div>
              <div className={styles.metricValue}>24</div>
              <div className={styles.metricFoot}><span className={styles.positive}>↗ 12%</span><span>vs. mes anterior</span></div>
            </article>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}><span>En producción</span><span className={`${styles.metricIcon} ${styles.iconAmber}`} aria-hidden="true">◷</span></div>
              <div className={styles.metricValue}>18</div>
              <div className={styles.metricFoot}><span className={styles.neutral}>6 para hoy</span><span>en 4 etapas</span></div>
            </article>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}><span>Por entregar</span><span className={`${styles.metricIcon} ${styles.iconBlue}`} aria-hidden="true">↗</span></div>
              <div className={styles.metricValue}>7</div>
              <div className={styles.metricFoot}><span className={styles.warning}>2 urgentes</span><span>próximos 3 días</span></div>
            </article>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}><span>Insumos por agotarse</span><span className={`${styles.metricIcon} ${styles.iconRose}`} aria-hidden="true">!</span></div>
              <div className={styles.metricValue}>3</div>
              <a className={styles.metricLink} href="#inventario">Revisar inventario <span aria-hidden="true">→</span></a>
            </article>
          </section>

          <div className={styles.mainGrid}>
            <section className={`${styles.panel} ${styles.ordersPanel}`} id="pedidos">
              <div className={styles.panelHeading}>
                <div><h2>Pedidos recientes</h2><p>Seguimiento de los últimos pedidos registrados</p></div>
                <a className={styles.textLink} href="#pedidos">Ver todos <span aria-hidden="true">→</span></a>
              </div>
              <div className={styles.tableTools}>
                <label className={styles.searchBox}>
                  <span aria-hidden="true">⌕</span>
                  <input aria-label="Buscar pedidos" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido o cliente" value={search} />
                </label>
                <select aria-label="Filtrar pedidos por estado" className={styles.filterSelect} onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                  <option>Todos</option><option>En producción</option><option>Pendiente</option><option>Listo</option>
                </select>
              </div>
              <div className={styles.tableScroller}>
                <table className={styles.orderTable}>
                  <thead><tr><th>Pedido</th><th>Producto</th><th>Entrega</th><th>Estado</th></tr></thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td><div className={styles.customerCell}><span className={`${styles.customerAvatar} ${styles[order.color]}`}>{order.initials}</span><span><strong>{order.customer}</strong><small>{order.id}</small></span></div></td>
                        <td className={styles.productCell}>{order.item}</td>
                        <td className={styles.dueCell}>{order.due}</td>
                        <td><span className={`${styles.status} ${order.status === 'Listo' ? styles.statusReady : order.status === 'Pendiente' ? styles.statusPending : styles.statusProduction}`}><i />{order.status}</span></td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && <tr><td className={styles.emptyState} colSpan={4}>No hay pedidos que coincidan con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.productionPanel}`} id="produccion">
              <div className={styles.panelHeading}>
                <div><h2>Producción de hoy</h2><p>Órdenes activas por etapa</p></div>
                <a className={styles.moreButton} href="#produccion" aria-label="Ver producción">···</a>
              </div>
              <div className={styles.stageList}>
                {stages.map((stage) => (
                  <div className={styles.stage} key={stage.name}>
                    <div className={styles.stageDetails}><span className={styles.stageName}><i className={`${styles.stageDot} ${styles[stage.color]}`} />{stage.name}</span><span>{stage.count}</span></div>
                    <div className={styles.progressTrack}><span className={styles[stage.color]} style={{ width: `${stage.progress}%` }} /></div>
                  </div>
                ))}
              </div>
              <a className={styles.panelBottomLink} href="#produccion">Ir a producción <span aria-hidden="true">→</span></a>
            </section>

            <section className={`${styles.panel} ${styles.inventoryPanel}`} id="inventario">
              <div className={styles.panelHeading}>
                <div><h2>Insumos por agotarse</h2><p>Materiales que requieren atención</p></div>
                <span className={styles.alertCount}>3 alertas</span>
              </div>
              <div className={styles.supplyList}>
                {supplies.map((supply) => (
                  <div className={styles.supply} key={supply.name}>
                    <div className={styles.supplyTop}><span className={styles.supplyName}>{supply.name}</span><strong>{supply.amount}</strong></div>
                    <div className={styles.supplyBottom}><span>{supply.detail}</span><span className={styles.supplyTrack}><i className={styles[supply.color]} style={{ width: `${supply.percent}%` }} /></span></div>
                  </div>
                ))}
              </div>
              <a className={styles.panelBottomLink} href="#inventario">Ver inventario <span aria-hidden="true">→</span></a>
            </section>

            <section className={`${styles.panel} ${styles.activityPanel}`} id="actividad">
              <div className={styles.panelHeading}>
                <div><h2>Actividad reciente</h2><p>Últimos movimientos del equipo</p></div>
                <a className={styles.moreButton} href="#actividad" aria-label="Ver actividad">···</a>
              </div>
              <div className={styles.activityList}>
                <div className={styles.activityItem}><span className={`${styles.activityIcon} ${styles.activityGreen}`}>✓</span><span><strong>Pedido FS-2084 pasó a confección</strong><small>Andrés P. · hace 18 min</small></span></div>
                <div className={styles.activityItem}><span className={`${styles.activityIcon} ${styles.activityBlue}`}>＋</span><span><strong>Nuevo pedido registrado</strong><small>María G. · hace 42 min</small></span></div>
                <div className={styles.activityItem}><span className={`${styles.activityIcon} ${styles.activityOrange}`}>↗</span><span><strong>Salida de tela dry fit · 8 m</strong><small>Laura R. · hace 1 h</small></span></div>
              </div>
            </section>
          </div>

          <footer className={styles.pageFooter}><span>Frenesí Sport · Gestión de producción</span><span>Datos de demostración</span></footer>
        </div>
      </section>
    </main>
  );
}