import { useMemo } from 'react';
import CodeMirror, { Decoration, EditorView, MatchDecorator, Prec, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from '@uiw/react-codemirror';
import { sql, SQLite } from '@codemirror/lang-sql';
import type { TableInfo } from '../db/build';
import { KEYWORD_RE, familyOfKeyword } from '../ui/clauseColors';

// Colour SQL keywords by clause family, the same colours as the step buttons.
const keywordMatcher = new MatchDecorator({
  regexp: new RegExp(KEYWORD_RE.source, 'gi'),
  decoration: (m) => Decoration.mark({ class: `kw-${familyOfKeyword(m[0])}` }),
});
const keywordColours = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = keywordMatcher.createDeco(view);
    }
    update(u: ViewUpdate) {
      this.decorations = keywordMatcher.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const theme = EditorView.theme(
  {
    '&': { backgroundColor: '#18233A', color: '#E8EDF3', fontSize: '16px' },
    '.cm-content': { fontFamily: "'Martian Mono', monospace", lineHeight: '2', caretColor: '#FFFFFF', padding: '12px 0 20px' },
    '.cm-gutters': { backgroundColor: '#18233A', color: '#7D8BA2', border: 'none', paddingLeft: '12px' },
    '.cm-lineNumbers .cm-gutterElement': { paddingRight: '16px', minWidth: '28px' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#C3CCD9' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#FFFFFF' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#2A3A5C !important' },
    '.cm-tooltip': { backgroundColor: '#FFFFFF', color: '#18233A', border: '1.5px solid #C9D4DE', borderRadius: '10px' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#2C6E57', color: '#FFFFFF' },
  },
  { dark: true },
);

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  schema: TableInfo[];
  /** Characters to underline as the error. */
  errorRange?: { from: number; to: number };
}

export function SqlEditor({ id, value, onChange, onRun, schema, errorRange }: Props) {
  const extensions = useMemo(() => {
    const tables = Object.fromEntries(schema.map((t) => [t.name, t.columns.map((c) => c.name)]));
    const ext = [
      sql({ dialect: SQLite, schema: tables, upperCaseKeywords: true }),
      theme,
      keywordColours,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ id, 'aria-label': 'Your query' }),
      Prec.highest(
        keymap.of([
          { key: 'Mod-Enter', run: () => (onRun(), true) },
          { key: 'Shift-Enter', run: () => (onRun(), true) },
        ]),
      ),
    ];
    if (errorRange && errorRange.to > errorRange.from && errorRange.to <= value.length) {
      ext.push(EditorView.decorations.of(Decoration.set([Decoration.mark({ class: 'cm-err' }).range(errorRange.from, errorRange.to)])));
    }
    return ext;
    // value is only read to keep the error range in bounds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, onRun, errorRange, id]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      minHeight="140px"
      basicSetup={{ foldGutter: false, highlightActiveLine: false, syntaxHighlighting: false }}
    />
  );
}
