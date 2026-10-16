import React from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered } from 'lucide-react';

export interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  forceLTR?: boolean;
}

// Links opened in a new tab must not get access to window.opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Sanitizes HTML before it is written into the editable DOM (prevents stored XSS). */
const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

/** Only web, mail, phone, site-relative (/...) and in-page anchor (#...) links are allowed. */
const SAFE_URL_PATTERN = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

const hasControlCharacters = (value: string) =>
  Array.from(value).some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

const isSafeLinkUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!trimmed || hasControlCharacters(trimmed)) return false;
  return SAFE_URL_PATTERN.test(trimmed);
};

/** Applies href/target and a safe rel to a link element. */
const applyLinkAttributes = (link: HTMLAnchorElement, href: string, target: string, classes: string) => {
  link.setAttribute('href', href);
  link.setAttribute('target', target);
  if (target === '_blank') {
    link.setAttribute('rel', 'noopener noreferrer');
  } else {
    link.removeAttribute('rel');
  }
  if (classes) {
    link.setAttribute('class', classes);
  }
};

const stripBidiMarksFromElementPreserveCaret = (el: HTMLElement) => {
  if (!el) return;
  const bidiRegex = /[\u200E\u200F\u202A-\u202E]/g;
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
  if (!bidiRegex.test(html)) return;
  const cleaned = html.replace(bidiRegex, '');
  el.innerHTML = cleaned;
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
  const [toolbarVisible, setToolbarVisible] = React.useState(false);
  const [toolbarLeft, setToolbarLeft] = React.useState(0);
  const [toolbarTop, setToolbarTop] = React.useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkText, setLinkText] = React.useState('');
  const [linkTarget, setLinkTarget] = React.useState('_blank');
  const [linkClasses, setLinkClasses] = React.useState('underline hover:text-club-accent hover:underline');
  const [savedSelection, setSavedSelection] = React.useState<Range | null>(null);
  const linkUrlInvalid = linkUrl.trim() !== '' && !isSafeLinkUrl(linkUrl);

  const updateSelection = React.useCallback(() => {
    const sel = document.getSelection();
    const contentEl = contentRef.current;
    if (!sel || sel.rangeCount === 0 || !contentEl) {
      setToolbarVisible(false);
      return;
    }
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

    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    if (!container) return setToolbarVisible(false);
    const cRect = container.getBoundingClientRect();
    const margin = 8;
    const tbW = toolbarRef.current?.offsetWidth ?? 120;
    const tbH = toolbarRef.current?.offsetHeight ?? 36;
    const selLeft = rect.left - cRect.left + container.scrollLeft;
    const selTop = rect.top - cRect.top + container.scrollTop;
    const selBottom = rect.bottom - cRect.top + container.scrollTop;
    const selCenterX = selLeft + rect.width / 2;
    const spaceAbove = selTop;
    const canPlaceAbove = spaceAbove >= tbH + margin;
    const top = canPlaceAbove ? selTop - (tbH + margin) : selBottom + margin;
    let left = selCenterX - tbW / 2;
    left = Math.max(margin, Math.min(left, cRect.width - tbW - margin));

    setToolbarLeft(left);
    setToolbarTop(top);
    setToolbarVisible(true);
  }, []);

  const wrapSelection = (tag: 'b' | 'i' | 'u') => {
    const cmd = tag === 'b' ? 'bold' : tag === 'i' ? 'italic' : 'underline';
    try {
      document.execCommand(cmd);
    } catch {
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

    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      onChange(el.innerHTML);
      updateSelection();
      el.focus();
    });
  };

  const toggleList = (listType: 'ol' | 'ul') => {
    const cmd = listType === 'ol' ? 'insertOrderedList' : 'insertUnorderedList';
    try {
      document.execCommand(cmd);
    } catch {
      // Fallback implementation
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const listEl = document.createElement(listType);
      const listItem = document.createElement('li');
      try {
        const frag = range.extractContents();
        listItem.appendChild(frag);
        listEl.appendChild(listItem);
        range.insertNode(listEl);
      } catch {
        // If extraction fails, just create an empty list item
        listEl.appendChild(listItem);
        range.insertNode(listEl);
      }
    }

    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      onChange(el.innerHTML);
      updateSelection();
      el.focus();
    });
  };

  const openLinkDialog = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    setSavedSelection(range.cloneRange());
    
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
      setLinkUrl(linkElement.getAttribute('href') || '');
      setLinkText(linkElement.textContent || '');
      setLinkTarget(linkElement.getAttribute('target') || '_blank');
      setLinkClasses(linkElement.getAttribute('class') || 'underline hover:text-club-accent hover:underline');
    } else {
      setLinkUrl('');
      setLinkText(sel.toString() || '');
      setLinkTarget('_blank');
      setLinkClasses('underline hover:text-club-accent hover:underline');
    }
    
    setLinkDialogOpen(true);
    setToolbarVisible(false);
  };

  const removeLink = () => {
    const el = contentRef.current;
    if (!el) return;
    
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

  const insertLink = () => {
    if (!linkUrl || !linkText || !isSafeLinkUrl(linkUrl)) return;
    const href = linkUrl.trim();
    
    const el = contentRef.current;
    if (!el) return;
    
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
      applyLinkAttributes(linkElement, href, linkTarget, linkClasses);
      linkElement.textContent = linkText;
    } else {
      const link = document.createElement('a');
      applyLinkAttributes(link, href, linkTarget, linkClasses);
      link.textContent = linkText;
      
      range.deleteContents();
      range.insertNode(link);
      
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

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (el.innerHTML === (value || '')) return;
    const safeHtml = sanitizeHtml(value || '');
    if (el.innerHTML === safeHtml) return;
    el.innerHTML = safeHtml;
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
          stripBidiMarksFromElementPreserveCaret(el);
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
          <Button variant="outline" size="sm" onClick={() => toggleList('ol')}><ListOrdered className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => toggleList('ul')}><List className="w-4 h-4" /></Button>
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
                aria-invalid={linkUrlInvalid}
                className={linkUrlInvalid ? 'border-red-500' : undefined}
              />
              {linkUrlInvalid && (
                <p className="text-xs text-red-600">
                  Ungültige URL. Erlaubt sind http(s)://, mailto:, tel:, relative Pfade (/…) und Anker (#…).
                </p>
              )}
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
              <Button onClick={insertLink} disabled={!linkUrl || !linkText || linkUrlInvalid}>
                {savedSelection ? 'Aktualisieren' : 'Einfügen'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
