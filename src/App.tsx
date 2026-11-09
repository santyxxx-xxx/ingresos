import { useCallback, useRef, useState } from 'react';
import { ArrowLeftRight, PieChart, Plus, Tags } from 'lucide-react';
import { FeedbackProvider } from './components/Feedback';
import { AccountProvider, useAccount } from './lib/account';
import { DataProvider } from './lib/data';
import { Login } from './components/Login';
import { TransactionSheet } from './components/TransactionSheet';
import { CategorySheet } from './components/CategorySheet';
import { SettingsSheet } from './components/SettingsSheet';
import { GroupSheet } from './components/GroupSheet';
import { RecurringSheet } from './components/RecurringSheet';
import { NameStep } from './components/NameStep';
import { Dashboard } from './screens/Dashboard';
import { Movements } from './screens/Movements';
import { Categories } from './screens/Categories';
import type { Category, Group, Transaction, TxType } from './lib/types';
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
      <AccountProvider>
        <Gate />
      </AccountProvider>
    </FeedbackProvider>
  );
}

function Gate() {
  const account = useAccount();
  if (!account.ready) return <div className="backdrop-art" aria-hidden="true" />;
  if (!account.session) return <Login />;
  if (!account.name) return <NameStep />;
  const uid = account.session.user.id;
  return (
    <DataProvider key={uid} uid={uid}>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const [dir, setDir] = useState<'left' | 'right' | 'fade'>('fade');
  const [month, setMonth] = useState(currentMonth());

  const [txSheet, setTxSheet] = useState<{ open: boolean; editing: Transaction | null; type: TxType }>({
    open: false,
    editing: null,
    type: 'expense'
  });
  const [catSheet, setCatSheet] = useState<{
    open: boolean;
    editing: Category | null;
    type: TxType;
    parent: Category | null;
  }>({ open: false, editing: null, type: 'expense', parent: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupSheet, setGroupSheet] = useState<{ open: boolean; editing: Group | null }>({ open: false, editing: null });
  const [recOpen, setRecOpen] = useState(false);
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
  const closeGroup = useCallback(() => setGroupSheet((s) => ({ ...s, open: false })), []);
  const closeRec = useCallback(() => setRecOpen(false), []);
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
                onGoCategories={() => go('cats')}
              />
            )}
            {tab === 'moves' && (
              <Movements
                month={month}
                setMonth={setMonth}
                onEdit={editTx}
                onSettings={openSettings}
                onRecurring={() => setRecOpen(true)}
              />
            )}
            {tab === 'cats' && (
              <Categories
                onEdit={(c) => setCatSheet({ open: true, editing: c, type: c.type, parent: null })}
                onNew={(type, parent) => setCatSheet({ open: true, editing: null, type, parent })}
                onEditGroup={(g) => setGroupSheet({ open: true, editing: g })}
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
      <CategorySheet
        open={catSheet.open}
        onClose={closeCat}
        editing={catSheet.editing}
        defaultType={catSheet.type}
        parent={catSheet.parent}
      />
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
      <GroupSheet open={groupSheet.open} onClose={closeGroup} editing={groupSheet.editing} />
      <RecurringSheet open={recOpen} onClose={closeRec} />
    </>
  );
}
