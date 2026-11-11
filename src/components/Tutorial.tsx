import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Repeat, Settings2, Split } from 'lucide-react';
import { haptic } from '../lib/utils';

interface Step {
  emoji: string;
  title: string;
  text: ReactNode;
  /** Pequeña muestra de cómo se ve en la app */
  demo?: ReactNode;
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Bienvenido a Ingresos',
    text: (
      <>
        Aquí anotas lo que <b>entra</b> y lo que <b>sale</b>, y la app te muestra en qué se va tu dinero. Te mostramos
        lo principal en un minuto.
      </>
    ),
    demo: (
      <div className="tut-demo tut-balance">
        <small>Balance del mes</small>
        <b className="display">$1.240,00</b>
        <div className="tut-row">
          <span className="c-income">↓ Ingresos $2.000</span>
          <span className="c-expense">↑ Gastos $760</span>
        </div>
      </div>
    )
  },
  {
    emoji: '➕',
    title: 'Registra con el botón +',
    text: (
      <>
        Abajo a la derecha está el botón <b>+</b>. Elige <b>Gasto</b> o <b>Ingreso</b>, escribe el monto, la categoría,
        el lugar y la fecha. Listo.
      </>
    ),
    demo: (
      <div className="tut-demo tut-center">
        <span className="tut-fab">
          <Plus size={26} strokeWidth={2} />
        </span>
        <div className="tut-seg">
          <span className="on">Gasto</span>
          <span>Ingreso</span>
          <span>Transferir</span>
        </div>
      </div>
    )
  },
  {
    emoji: '🏠',
    title: 'Secciones: ¿de quién es?',
    text: (
      <>
        Cada movimiento va a una <b>sección</b>: Casa, Personal, Hijo, Esposa… Así sabes cuánto gasta cada uno. Crea
        las que quieras con <b>+ Nueva</b>.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="chips">
          <span className="chip section" aria-pressed="true">
            <span className="e">🏠</span>Casa
          </span>
          <span className="chip">
            <span className="e">🙋</span>Personal
          </span>
          <span className="chip">
            <span className="e">👦</span>Hijo
          </span>
          <span className="chip add">
            <Plus size={14} strokeWidth={2} />
            Nueva
          </span>
        </div>
      </div>
    )
  },
  {
    emoji: '🏷️',
    title: 'Categorías y subcategorías',
    text: (
      <>
        Ordena tus gastos: <b>Comida › Supermercado</b>, <b>Comida › Restaurantes</b>. Puedes crearlas al registrar un
        gasto o en la pestaña <b>Categorías</b>.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="chips">
          <span className="chip expense" aria-pressed="true">
            <span className="e">🍽️</span>Comida
          </span>
          <span className="chip">
            <span className="e">🚕</span>Transporte
          </span>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          <span className="chip small">General</span>
          <span className="chip small" aria-pressed="true">
            <span className="e">🛒</span>Supermercado
          </span>
          <span className="chip small">
            <span className="e">🍕</span>Restaurantes
          </span>
        </div>
      </div>
    )
  },
  {
    emoji: '💵',
    title: 'Divide y transfiere',
    text: (
      <>
        ¿Te llega el sueldo y una parte es para la casa? Al registrar un ingreso usa <b>Dividir entre secciones</b>. Para
        pasar dinero de una sección a otra usa <b>Transferir</b>: no cuenta como gasto.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="tut-line">
          <Split size={16} strokeWidth={1.75} /> Sueldo $1.000
        </div>
        <div className="tut-split">
          <span>🏠 Casa</span>
          <b>$600</b>
        </div>
        <div className="tut-split">
          <span>🙋 Personal</span>
          <b>$400</b>
        </div>
      </div>
    )
  },
  {
    emoji: '🔁',
    title: 'Gastos que se repiten',
    text: (
      <>
        Arriendo, internet, una mesada… Actívalos con <b>Repetir</b> (cada mes o cada semana) y se registran solos. Los
        ves y pausas en <b>Movimientos → Recurrentes</b>.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="tut-line">
          <Repeat size={16} strokeWidth={1.75} /> Arriendo · día 5 de cada mes
        </div>
        <div className="tut-line">
          <Repeat size={16} strokeWidth={1.75} /> Mesada · cada lunes
        </div>
      </div>
    )
  },
  {
    emoji: '🎯',
    title: 'Presupuestos',
    text: (
      <>
        En <b>Categorías</b>, toca una categoría y ponle un límite al mes. En el resumen verás cuánto llevas y te
        avisamos si te acercas o te pasas.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="tut-split">
          <span>🍽️ Comida</span>
          <b>
            $240 <small>/ $300</small>
          </b>
        </div>
        <div className="budget-bar warn-demo">
          <span style={{ width: '80%' }} />
        </div>
        <small className="tut-muted">Te quedan $60</small>
      </div>
    )
  },
  {
    emoji: '📊',
    title: 'Tu resumen',
    text: (
      <>
        En <b>Resumen</b> ves el <b>Total</b> o cada sección: en qué gastas más, dónde compras, cómo vas frente al mes
        anterior y los gastos fijos que vienen. Cambia de mes con las flechas.
      </>
    ),
    demo: (
      <div className="tut-demo">
        <div className="group-filter tut-filter">
          <button aria-selected="true">Total</button>
          <button>🏠 Casa</button>
          <button>🙋 Personal</button>
        </div>
        <div className="tut-bars">
          {[40, 55, 35, 70, 50, 62].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} className={i === 5 ? 'on' : ''} />
          ))}
        </div>
      </div>
    )
  },
  {
    emoji: '⚙️',
    title: '¿Dudas? Está en Ajustes',
    text: (
      <>
        Con el ícono de ajustes, arriba a la derecha, cambias tu nombre, descargas una copia de tus datos, cierras
        sesión y puedes <b>volver a ver este tutorial</b> cuando quieras.
      </>
    ),
    demo: (
      <div className="tut-demo tut-center">
        <span className="tut-gear">
          <Settings2 size={22} strokeWidth={1.75} />
        </span>
      </div>
    )
  }
];

export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  function go(delta: number) {
    const n = i + delta;
    if (n < 0) return;
    if (n >= STEPS.length) {
      onClose();
      return;
    }
    haptic(6);
    setDir(delta > 0 ? 'next' : 'prev');
    setI(n);
  }

  return createPortal(
    <div
      className="tutorial"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="backdrop-art" aria-hidden="true">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
      </div>

      <div className="tutorial-inner">
        <div className="tutorial-top">
          <span className="tutorial-count">
            {i + 1} de {STEPS.length}
          </span>
          {!last && (
            <button className="tutorial-skip" onClick={onClose}>
              Omitir
            </button>
          )}
        </div>

        <div key={i} className={`tutorial-step ${dir === 'next' ? 'anim-right' : 'anim-left'}`}>
          <div className="tutorial-emoji">{step.emoji}</div>
          <h2 className="display">{step.title}</h2>
          <p>{step.text}</p>
          {step.demo && <div className="tutorial-demo glass">{step.demo}</div>}
        </div>

        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>

        <div className="tutorial-actions">
          {i > 0 ? (
            <button className="btn btn-ghost" onClick={() => go(-1)} aria-label="Anterior">
              <ArrowLeft size={19} strokeWidth={1.75} />
            </button>
          ) : (
            <span />
          )}
          <button className="btn btn-primary" onClick={() => go(1)}>
            {last ? (
              <>
                <Check size={19} strokeWidth={2} /> Empezar
              </>
            ) : (
              <>
                Siguiente <ArrowRight size={19} strokeWidth={1.75} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
