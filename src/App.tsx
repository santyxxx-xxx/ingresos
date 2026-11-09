import { useCallback, useRef, useState } from 'react';
import { ArrowLeftRight, PieChart, Plus, Tags } from 'lucide-react';
import { FeedbackProvider } from './components/Feedback';
import { CloudProvider } from './lib/cloud';
import { TransactionSheet } from './components/TransactionSheet';
import { CategorySheet } from './components/CategorySheet';
import { SettingsSheet } from './components/SettingsSheet';
import { Dashboard } from './screens/Dashboard';
import { Movements } from './screens/Movements';
import { Categories } from './screens/Categories';
import { useTheme } from './lib/hooks';
import type { Category, Transaction, TxType } from './lib/types';
import { currentMonth, haptic } from './lib/utils';

type Tab = 'home' | 'moves' | 'cats';
const TABS: Array<{ id: Tab; label: string; Icon: typeof PieChart }> = [
  { id: 'home', label: 'Resumen', Icon: PieChart },
  { id: 'moves', label: 'Movimientos', Icon: ArrowLeftRight },
  { id: 'cats', label: 'Categorías', Icon: Tags }
];

export default function App() {
  return (
    <FeedbackProvider>
      <CloudProvider>
        <Shell />
      </CloudProvider>
    </FeedbackProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const [dir, setDir] = useState<'left' | 'right' | 'fade'>('fade');
  const [month, setMonth] = useState(currentMonth());
  const [theme, setTheme] = useTheme();

  const [txSheet, setTxSheet] = useState<{ open: boolean; editing: Transaction | null; type: TxType }>({
    open: false,
    editing: null,
    type: 'expense'
  });
  const [catSheet, setCatSheet] = useState<{ open: boolean; editing: Category | null; type: TxType }>({
    open: false,
    editing: null,
    type: 'expense'
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  const go = (next: Tab) => {
    if (next === tab) {
      screenRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    haptic(6);
    const a = TABS.findIndex((t) => t.id === tab);
    const b = TABS.findIndex((t) => t.id === next);
    setDir(b > a ? 'right' : 'left');
    setTab(next);
  };

  const addTx = () => {
    haptic(10);
    setTxSheet({ open: true, editing: null, type: 'expense' });
  };
  const editTx = (t: Transaction) => setTxSheet({ open: true, editing: t, type: t.type });
  const closeTx = useCallback(() => setTxSheet((s) => ({ ...s, open: false })), []);
  const closeCat = useCallback(() => setCatSheet((s) => ({ ...s, open: false })), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSettings = () => setSettingsOpen(true);

  const activeIdx = TABS.findIndex((t) => t.id === tab);

  return (
    <>
      <div className="backdrop-art" aria-hidden="true">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
        <span className="b4" />
      </div>

      <div className="app">
        <main className="screens">
          <div key={tab} ref={screenRef} className={`screen anim-${dir}`}>
            {tab === 'home' && (
              <Dashboard
                month={month}
                setMonth={setMonth}
                onEdit={editTx}
                onAdd={addTx}
                onSeeAll={() => go('moves')}
                onSettings={openSettings}
              />
            )}
            {tab === 'moves' && (
              <Movements month={month} setMonth={setMonth} onEdit={editTx} onSettings={openSettings} />
            )}
            {tab === 'cats' && (
              <Categories
                onEdit={(c) => setCatSheet({ open: true, editing: c, type: c.type })}
                onNew={(type) => setCatSheet({ open: true, editing: null, type })}
                onSettings={openSettings}
              />
            )}
          </div>
        </main>

        <div className="dock">
          <nav className="nav glass" aria-label="Navegación principal">
            <span className="thumb" style={{ transform: `translateX(${activeIdx * 100}%)` }} />
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                <Icon size={22} strokeWidth={tab === id ? 2 : 1.6} />
                {label}
              </button>
            ))}
          </nav>
          <button className="fab" onClick={addTx} aria-label="Agregar movimiento">
            <Plus size={30} strokeWidth={2} />
          </button>
        </div>
      </div>

      <TransactionSheet open={txSheet.open} onClose={closeTx} editing={txSheet.editing} defaultType={txSheet.type} />
      <CategorySheet open={catSheet.open} onClose={closeCat} editing={catSheet.editing} defaultType={catSheet.type} />
      <SettingsSheet open={settingsOpen} onClose={closeSettings} theme={theme} setTheme={setTheme} />
    </>
  );
}
