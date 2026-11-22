// Scroll stack, after the React Bits ScrollStack (https://reactbits.dev), rebuilt
// to stay smooth on low-end phones: no JavaScript runs while scrolling.
//
// - Each card sits in a `position: sticky` slot, so the browser pins it and the
//   next card slides over it: pure scrolling, no per-frame work.
// - An IntersectionObserver notes which card is on top (it fires only when a
//   card crosses a line, never per frame) and gives every slot its depth below
//   the top card. Covered cards fade a little darker; cards three or more below
//   the top fade out and stop being drawn, so however many cards have landed,
//   the phone only ever draws three. Without this, every landed card stayed a
//   full-size layer and phones ran out of graphics memory (flicker by card 4-5).
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './ScrollStack.css';

export interface ScrollStackItemProps {
  children?: ReactNode;
  itemClassName?: string;
  style?: CSSProperties;
}

export interface ScrollStackProps {
  children?: ReactNode;
  className?: string;
  /** space between cards before they stack, in px */
  itemDistance?: number;
  /** how much of each card below stays visible once stacked, in px */
  itemStackDistance?: number;
  /** where the stack pins, from the top of the viewport */
  stackPosition?: string;
  /**
   * Called with the index of the card on top of the stack whenever it changes
   * (-1 before the first card pins). Fired by an IntersectionObserver.
   */
  onTopCardChange?: (index: number) => void;
}

export const ScrollStackItem = ({ children, itemClassName = '', style }: ScrollStackItemProps) => (
  <div className={`scroll-stack-card ${itemClassName}`.trim()} style={style}>
    {children}
    <span className="scroll-stack-card__shade" aria-hidden="true" />
  </div>
);

const ScrollStack = ({
  children,
  className = '',
  itemDistance = 48,
  itemStackDistance = 16,
  stackPosition = '12%',
  onTopCardChange,
}: ScrollStackProps) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onTopCardChange);
  const items = Children.toArray(children);
  const count = items.length;

  useEffect(() => {
    callbackRef.current = onTopCardChange;
  });

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const slots = Array.from(inner.querySelectorAll<HTMLElement>(':scope > [data-stack-slot]'));
    const inBand = new Set<number>();
    let top = -2;
    // a card counts as on top once its top edge is in the upper 45% of the screen
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.stackSlot);
          if (e.isIntersecting) inBand.add(i);
          else inBand.delete(i);
        }
        const next = inBand.size ? Math.max(...inBand) : -1;
        if (next === top) return;
        top = next;
        slots.forEach((slot, i) => {
          const depth = top < 0 || i > top ? 0 : Math.min(top - i, 3);
          if (slot.dataset.depth !== String(depth)) slot.dataset.depth = String(depth);
        });
        callbackRef.current?.(next);
      },
      { rootMargin: '0px 0px -55% 0px' },
    );
    slots.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [count]);

  return (
    <div className={`scroll-stack ${className}`.trim()}>
      <div ref={innerRef} className="scroll-stack__inner">
        {items.map((child, index) => (
          <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>
            <div
              data-stack-slot={index}
              data-depth="0"
              className="scroll-stack__slot"
              style={
                {
                  top: `calc(${stackPosition} + ${index * itemStackDistance}px)`,
                  marginTop: index > 0 ? itemDistance : 0,
                  zIndex: index + 1,
                } as CSSProperties
              }
            >
              {child}
            </div>
          </Fragment>
        ))}
        <div className="scroll-stack__end" aria-hidden="true" />
      </div>
    </div>
  );
};

export default ScrollStack;
