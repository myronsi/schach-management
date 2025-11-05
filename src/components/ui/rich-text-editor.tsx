import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bold, Italic, Underline, Link as LinkIcon } from 'lucide-react';

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

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkText, setLinkText] = React.useState('');
  const [linkTarget, setLinkTarget] = React.useState('_blank');
  const [linkClasses, setLinkClasses] = React.useState('underline hover:text-club-accent hover:underline');
  const [savedSelection, setSavedSelection] = React.useState<Range | null>(null);

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

  // Open link dialog
  const openLinkDialog = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    setSavedSelection(range.cloneRange());
    
    // Check if selection is within a link
    let node: Node | null = range.commonAncestorContainer;
    let linkElement: HTMLAnchorElement | null = null;
    
    while (node && node !== contentRef.current) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === 'A') {
        linkElement = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    
    if (linkElement) {
      // Editing existing link
      setLinkUrl(linkElement.getAttribute('href') || '');
      setLinkText(linkElement.textContent || '');
      setLinkTarget(linkElement.getAttribute('target') || '_blank');
      setLinkClasses(linkElement.getAttribute('class') || 'underline hover:text-club-accent hover:underline');
    } else {
      // Creating new link
      setLinkUrl('');
      setLinkText(sel.toString() || '');
      setLinkTarget('_blank');
      setLinkClasses('underline hover:text-club-accent hover:underline');
    }
    
    setLinkDialogOpen(true);
    setToolbarVisible(false);
  };

  // Remove link but keep text
  const removeLink = () => {
    const el = contentRef.current;
    if (!el) return;
    
    // Restore selection
    if (savedSelection) {
      const sel = document.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelection);
      }
    }
    
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    
    // Find the link element
    let node: Node | null = range.commonAncestorContainer;
    let linkElement: HTMLAnchorElement | null = null;
    
    while (node && node !== el) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === 'A') {
        linkElement = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    
    if (linkElement) {
      // Replace link with its text content
      const textNode = document.createTextNode(linkElement.textContent || '');
      linkElement.parentNode?.replaceChild(textNode, linkElement);
      
      onChange(el.innerHTML);
    }
    
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
    setSavedSelection(null);
    el.focus();
  };

  // Insert or update link
  const insertLink = () => {
    if (!linkUrl || !linkText) return;
    
    const el = contentRef.current;
    if (!el) return;
    
    // Restore selection
    if (savedSelection) {
      const sel = document.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelection);
      }
    }
    
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    
    // Check if we're editing an existing link
    let node: Node | null = range.commonAncestorContainer;
    let linkElement: HTMLAnchorElement | null = null;
    
    while (node && node !== el) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === 'A') {
        linkElement = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    
    if (linkElement) {
      linkElement.setAttribute('href', linkUrl);
      linkElement.textContent = linkText;
      linkElement.setAttribute('target', linkTarget);
      if (linkClasses) {
        linkElement.setAttribute('class', linkClasses);
      }
    } else {
      const link = document.createElement('a');
      link.setAttribute('href', linkUrl);
      link.setAttribute('target', linkTarget);
      if (linkClasses) {
        link.setAttribute('class', linkClasses);
      }
      link.textContent = linkText;
      
      range.deleteContents();
      range.insertNode(link);
      
      // Move cursor after link
      range.setStartAfter(link);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    
    onChange(el.innerHTML);
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
    setSavedSelection(null);
    el.focus();
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
          <Button variant="outline" size="sm" onClick={openLinkDialog}><LinkIcon className="w-4 h-4" /></Button>
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link einfügen/bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-text">Link-Text</Label>
              <Input
                id="link-text"
                placeholder="Text der angezeigt wird"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-target">Ziel</Label>
              <select
                id="link-target"
                value={linkTarget}
                onChange={(e) => setLinkTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="_blank">Neues Fenster (_blank)</option>
                <option value="_self">Gleiches Fenster (_self)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-classes">CSS-Klassen</Label>
              <Input
                id="link-classes"
                placeholder="CSS-Klassen (optional)"
                value={linkClasses}
                onChange={(e) => setLinkClasses(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Standard: underline hover:text-club-accent hover:underline
              </p>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button 
              variant="destructive" 
              onClick={removeLink}
              disabled={!linkUrl}
            >
              Link entfernen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={insertLink} disabled={!linkUrl || !linkText}>
                {savedSelection ? 'Aktualisieren' : 'Einfügen'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
