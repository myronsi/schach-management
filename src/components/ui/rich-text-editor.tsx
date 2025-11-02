import React from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline } from 'lucide-react';

export interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  forceLTR?: boolean;
}

// Helper: remove Unicode bidi control chars while preserving caret position
const stripBidiMarksFromElementPreserveCaret = (el: HTMLElement) => {
  if (!el) return;
  const bidiRegex = /[\u200E\u200F\u202A-\u202E]/g;
  // get caret offset
  const getCaretOffset = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(el);
    range.setEnd(sel.focusNode || el, sel.focusOffset);
    return range.toString().length;
  };

  const setCaretOffset = (chars: number) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    let remaining = chars;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let current: Node | null = walker.nextNode();
    while (current) {
      const len = (current.textContent || '').length;
      if (remaining <= len) {
        range.setStart(current, remaining);
        range.collapse(true);
        const sel = document.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }
      remaining -= len;
      current = walker.nextNode();
    }
    // fallback: place at end
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = document.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const beforeOffset = getCaretOffset();
  const html = el.innerHTML;
  if (!bidiRegex.test(html)) return; // nothing to do
  const cleaned = html.replace(bidiRegex, '');
  el.innerHTML = cleaned;
  // restore caret at approximately same character offset
  const newOffset = Math.min(beforeOffset, el.textContent ? el.textContent.length : 0);
  setCaretOffset(newOffset);
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value,
  onChange,
  className,
  placeholder,
  forceLTR = true,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);

  // Floating toolbar state
  const [toolbarVisible, setToolbarVisible] = React.useState(false);
  const [toolbarLeft, setToolbarLeft] = React.useState(0);
  const [toolbarTop, setToolbarTop] = React.useState(0);

  // Update selection and position toolbar near selection
  const updateSelection = React.useCallback(() => {
    const sel = document.getSelection();
    const contentEl = contentRef.current;
    if (!sel || sel.rangeCount === 0 || !contentEl) {
      setToolbarVisible(false);
      return;
    }
    // Ensure selection is inside the editor
    const range = sel.getRangeAt(0);
    const root = range.commonAncestorContainer;
    const isInside = contentEl.contains(root.nodeType === 1 ? (root as Element) : root.parentNode as Node);
    if (!isInside) {
      setToolbarVisible(false);
      return;
    }
    const text = String(sel.toString() || '');
    if (text.length === 0) {
      setToolbarVisible(false);
      return;
    }

    // compute bounding rect relative to containerRef
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    if (!container) return setToolbarVisible(false);
    const cRect = container.getBoundingClientRect();

    // Toolbar size and margins
    const margin = 8;
    const tbW = toolbarRef.current?.offsetWidth ?? 120;
    const tbH = toolbarRef.current?.offsetHeight ?? 36;

    const selLeft = rect.left - cRect.left + container.scrollLeft;
    const selTop = rect.top - cRect.top + container.scrollTop;
    const selBottom = rect.bottom - cRect.top + container.scrollTop;
    const selCenterX = selLeft + rect.width / 2;

    // Try above by default; if not enough space above, place below
    const spaceAbove = selTop;
    const canPlaceAbove = spaceAbove >= tbH + margin;
    let top = canPlaceAbove ? selTop - (tbH + margin) : selBottom + margin;

    // Center horizontally over selection and clamp within container
    let left = selCenterX - tbW / 2;
    left = Math.max(margin, Math.min(left, cRect.width - tbW - margin));

    setToolbarLeft(left);
    setToolbarTop(top);
    setToolbarVisible(true);
  }, []);

  // Formatting using execCommand with fallback to manual range wrap
  const wrapSelection = (tag: 'b' | 'i' | 'u') => {
    const cmd = tag === 'b' ? 'bold' : tag === 'i' ? 'italic' : 'underline';
    try {
      document.execCommand(cmd);
    } catch (e) {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const el = document.createElement(tag);
      try {
        range.surroundContents(el);
      } catch {
        const frag = range.extractContents();
        el.appendChild(frag);
        range.insertNode(el);
      }
    }

    // update stored HTML from the editable div
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      onChange(el.innerHTML);
      updateSelection();
      el.focus();
    });
  };

  // Effect: enforce LTR on mount and when flag changes
  React.useEffect(() => {
    if (!forceLTR) return;
    let cancelled = false;
    const applyLTR = () => {
      if (cancelled) return;
      const el = contentRef.current;
      if (!el) {
        requestAnimationFrame(applyLTR);
        return;
      }
      el.setAttribute('dir', 'ltr');
      el.style.direction = 'ltr';
      el.style.unicodeBidi = 'isolate-override';
      el.style.textAlign = 'left';
    };
    requestAnimationFrame(applyLTR);
    return () => { cancelled = true; };
  }, [forceLTR]);

  // Effect: sync prop value into editor only when different from current DOM
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (el.innerHTML === (value || '')) return;
    el.innerHTML = value || '';
  }, [value]);

  return (
    <div className={"relative " + (className || '')} ref={containerRef}>
      <div
        id={id}
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const el = contentRef.current;
          if (!el) return;
          // strip bidi marks if present while preserving caret
          stripBidiMarksFromElementPreserveCaret(el);
          // propagate change
          onChange(el.innerHTML.replace(/[\u200E\u200F\u202A-\u202E]/g, ''));
        }}
        onMouseUp={updateSelection}
        onKeyUp={updateSelection}
        className="prose max-w-none min-h-[240px] md:min-h-[360px] resize-vertical border rounded p-3 bg-white overflow-auto text-left"
        style={{ direction: forceLTR ? 'ltr' : undefined, unicodeBidi: 'isolate' }}
        data-placeholder={placeholder}
      />

      {toolbarVisible && (
        <div
          ref={toolbarRef}
          className="absolute flex gap-2 bg-white border rounded p-1 shadow"
          style={{ left: toolbarLeft, top: toolbarTop, zIndex: 40 }}
        >
          <Button variant="outline" size="sm" onClick={() => wrapSelection('b')}><Bold className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => wrapSelection('i')}><Italic className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => wrapSelection('u')}><Underline className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
};
