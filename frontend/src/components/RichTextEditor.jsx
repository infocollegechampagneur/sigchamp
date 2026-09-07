import React, { useEffect, useRef } from "react";
import { Bold, Italic, Underline, CornerDownLeft } from "lucide-react";

export function RichTextEditor({ value, revision = 0, onChange, testId = "rich-text-editor" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const emit = () => onChange(ref.current ? ref.current.innerHTML : "");

  const exec = (cmd) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, false); } catch (e) { /* noop */ }
    document.execCommand(cmd, false, null);
    emit();
  };

  const insertBreak = () => {
    ref.current?.focus();
    document.execCommand("insertLineBreak", false, null);
    emit();
  };

  const btn = "flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors";

  return (
    <div className="mt-1.5 rounded-md border border-slate-700 bg-slate-800/60 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-slate-700 px-2 py-1.5 bg-slate-900/40">
        <button type="button" onClick={() => exec("bold")} className={btn} title="Gras" data-testid="rte-bold"><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("italic")} className={btn} title="Italique" data-testid="rte-italic"><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => exec("underline")} className={btn} title="Souligné" data-testid="rte-underline"><Underline className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button type="button" onClick={insertBreak} className={btn} title="Saut de ligne" data-testid="rte-linebreak"><CornerDownLeft className="h-4 w-4" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-testid={testId}
        className="min-h-[110px] max-h-[240px] overflow-y-auto px-3 py-2.5 text-sm text-white leading-relaxed outline-none rte-content"
      />
    </div>
  );
}

export default RichTextEditor;
