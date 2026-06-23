// ---------------------------------------------------------------------------
// Row-level formula compiler — custom_calculated_fields → SQL expression.
//
// Compiles an Excel/FileMaker-style formula (e.g. `=Quantity * UnitPrice`,
// `=IF(Total>0, Margin/Total, 0)`) into a SQLite expression string.
//
// Safety model:
//   - Identifiers (field references) are NEVER string-concatenated. Every
//     bare name in the formula must appear in the calc field's `dependencies`
//     and resolve, via the caller-supplied resolver, to a column reference
//     produced by the allow-list identifier helpers. Unknown names throw.
//   - Numeric literals are inlined directly (already safe — they are parsed
//     to JS numbers and re-serialised). String literals are emitted as SQL
//     string literals with single-quotes doubled. No formula value is bound
//     as a `?` param (the base-CTE builder binds filter params instead).
//   - Division compiles `a / b` as `a / NULLIF(b, 0)` to avoid divide-by-zero.
//   - Only an allow-list of node kinds / functions is accepted; anything else
//     throws a clear Error that the caller surfaces.
//
// Pure module — no React / Next.js imports, no DB calls.
// ---------------------------------------------------------------------------

import type { CustomCalcField } from '../reportConfigTypes';
import type { SqlSetup } from './types';
import { columnAlias } from './identifiers';

// ---------------------------------------------------------------------------
// Field resolver
// ---------------------------------------------------------------------------

/**
 * Resolves a dependency name (as written inside a formula) to a SQL column
 * reference. The base-CTE builder supplies this so that the same resolution
 * logic (and the same allow-list helpers) are reused everywhere.
 *
 * Implementations MUST throw if the name is not an allowed dependency / field.
 */
export type FieldResolver = (name: string) => string;

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'field'; name: string }
  | { kind: 'unary'; op: '-' | '+'; operand: AstNode }
  | { kind: 'binary'; op: BinaryOp; left: AstNode; right: AstNode }
  | { kind: 'call'; name: AllowedFn; args: AstNode[] };

type BinaryOp = '+' | '-' | '*' | '/' | '%' | '>' | '<' | '>=' | '<=' | '=' | '!=' | '<>';

type AllowedFn = 'IF' | 'ABS' | 'ROUND' | 'MIN' | 'MAX';

const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set<AllowedFn>([
  'IF',
  'ABS',
  'ROUND',
  'MIN',
  'MAX',
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
  const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

  while (i < n) {
    const c = input[i];

    // Whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // Numeric literal (integer or decimal)
    if (/[0-9]/.test(c) || (c === '.' && i + 1 < n && /[0-9]/.test(input[i + 1]))) {
      let j = i;
      let seenDot = false;
      while (j < n && (/[0-9]/.test(input[j]) || (input[j] === '.' && !seenDot))) {
        if (input[j] === '.') seenDot = true;
        j++;
      }
      const raw = input.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(`formulaToSql: invalid numeric literal "${raw}"`);
      }
      tokens.push({ type: 'number', value });
      i = j;
      continue;
    }

    // String literal — supports single- or double-quoted; quotes are escaped
    // by doubling them (Excel/SQL convention).
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let str = '';
      let closed = false;
      while (j < n) {
        if (input[j] === quote) {
          if (j + 1 < n && input[j + 1] === quote) {
            str += quote;
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        str += input[j];
        j++;
      }
      if (!closed) {
        throw new Error(`formulaToSql: unterminated string literal`);
      }
      tokens.push({ type: 'string', value: str });
      i = j;
      continue;
    }

    // Backtick-wrapped identifier (allows field names containing spaces, e.g. `Total Price`)
    if (c === '`') {
      let j = i + 1;
      let name = '';
      let closed = false;
      while (j < n) {
        if (input[j] === '`') {
          closed = true;
          j++;
          break;
        }
        name += input[j];
        j++;
      }
      if (!closed) {
        throw new Error(`formulaToSql: unterminated backtick identifier`);
      }
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        throw new Error(`formulaToSql: empty backtick identifier`);
      }
      tokens.push({ type: 'ident', value: trimmed });
      i = j;
      continue;
    }

    // Identifier / function name
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(input[j])) j++;
      tokens.push({ type: 'ident', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Parentheses & comma
    if (c === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }

    // Multi-char operators first
    const two = input.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ type: 'op', value: two === '==' ? '=' : two });
      i += 2;
      continue;
    }

    // Single-char operators
    if ('+-*/%><='.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }

    throw new Error(`formulaToSql: unexpected character "${c}" in formula`);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent, standard precedence)
//
//   expression := comparison
//   comparison := additive ( (>|<|>=|<=|=|!=|<>) additive )*
//   additive   := multiplicative ( (+|-) multiplicative )*
//   multiplicative := unary ( (*|/|%) unary )*
//   unary      := (+|-) unary | primary
//   primary    := number | string | ident | ident '(' args ')' | '(' expression ')'
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const node = this.parseComparison();
    if (this.pos !== this.tokens.length) {
      throw new Error(`formulaToSql: unexpected trailing tokens in formula`);
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error(`formulaToSql: unexpected end of formula`);
    this.pos++;
    return t;
  }

  private parseComparison(): AstNode {
    let left = this.parseAdditive();
    while (true) {
      const t = this.peek();
      if (
        t &&
        t.type === 'op' &&
        (t.value === '>' ||
          t.value === '<' ||
          t.value === '>=' ||
          t.value === '<=' ||
          t.value === '=' ||
          t.value === '!=' ||
          t.value === '<>')
      ) {
        this.pos++;
        const right = this.parseAdditive();
        left = { kind: 'binary', op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.pos++;
        const right = this.parseMultiplicative();
        left = { kind: 'binary', op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        this.pos++;
        const right = this.parseUnary();
        left = { kind: 'binary', op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): AstNode {
    const t = this.peek();
    if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      this.pos++;
      const operand = this.parseUnary();
      return { kind: 'unary', op: t.value as '+' | '-', operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const t = this.next();

    if (t.type === 'number') {
      return { kind: 'number', value: t.value };
    }

    if (t.type === 'string') {
      return { kind: 'string', value: t.value };
    }

    if (t.type === 'lparen') {
      const node = this.parseComparison();
      const close = this.next();
      if (close.type !== 'rparen') {
        throw new Error(`formulaToSql: expected ")"`);
      }
      return node;
    }

    if (t.type === 'ident') {
      // Function call?
      const after = this.peek();
      if (after && after.type === 'lparen') {
        const upper = t.value.toUpperCase();
        if (!ALLOWED_FUNCTIONS.has(upper)) {
          throw new Error(
            `formulaToSql: unsupported function "${t.value}". ` +
              `Allowed: [${Array.from(ALLOWED_FUNCTIONS).join(', ')}]`,
          );
        }
        this.pos++; // consume '('
        const args: AstNode[] = [];
        if (this.peek()?.type !== 'rparen') {
          args.push(this.parseComparison());
          while (this.peek()?.type === 'comma') {
            this.pos++;
            args.push(this.parseComparison());
          }
        }
        const close = this.next();
        if (close.type !== 'rparen') {
          throw new Error(`formulaToSql: expected ")" to close ${t.value}(...)`);
        }
        return { kind: 'call', name: upper as AllowedFn, args };
      }

      // Bare identifier → field reference
      return { kind: 'field', name: t.value };
    }

    throw new Error(`formulaToSql: unexpected token in formula`);
  }
}

// ---------------------------------------------------------------------------
// Emit — AST → SQL expression string
// ---------------------------------------------------------------------------

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function emit(node: AstNode, resolver: FieldResolver): string {
  switch (node.kind) {
    case 'number':
      // Re-serialise the parsed JS number — guaranteed numeric, safe to inline.
      return String(node.value);

    case 'string':
      return quoteSqlString(node.value);

    case 'field':
      // Identifiers ONLY via the resolver (allow-list). Throws if unknown.
      return resolver(node.name);

    case 'unary':
      return `(${node.op}${emit(node.operand, resolver)})`;

    case 'binary': {
      const left = emit(node.left, resolver);
      const right = emit(node.right, resolver);
      if (node.op === '/') {
        // Division safety: never divide by zero.
        return `(${left} / NULLIF(${right}, 0))`;
      }
      if (node.op === '%') {
        // SQLite uses % as the modulo operator; guard the divisor too.
        return `(${left} % NULLIF(${right}, 0))`;
      }
      if (node.op === '!=' || node.op === '<>') {
        return `(${left} <> ${right})`;
      }
      if (node.op === '=') {
        return `(${left} = ${right})`;
      }
      return `(${left} ${node.op} ${right})`;
    }

    case 'call':
      return emitCall(node, resolver);

    default: {
      // Exhaustiveness guard.
      const _never: never = node;
      throw new Error(`formulaToSql: unhandled node ${JSON.stringify(_never)}`);
    }
  }
}

function emitCall(node: Extract<AstNode, { kind: 'call' }>, resolver: FieldResolver): string {
  const args = node.args.map((a) => emit(a, resolver));

  switch (node.name) {
    case 'IF': {
      if (args.length !== 3) {
        throw new Error(`formulaToSql: IF() requires exactly 3 arguments`);
      }
      return `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`;
    }
    case 'ABS': {
      if (args.length !== 1) {
        throw new Error(`formulaToSql: ABS() requires exactly 1 argument`);
      }
      return `ABS(${args[0]})`;
    }
    case 'ROUND': {
      if (args.length < 1 || args.length > 2) {
        throw new Error(`formulaToSql: ROUND() requires 1 or 2 arguments`);
      }
      return `ROUND(${args.join(', ')})`;
    }
    case 'MIN': {
      if (args.length < 1) {
        throw new Error(`formulaToSql: MIN() requires at least 1 argument`);
      }
      // SQLite MIN(a,b,...) is the scalar (row-level) min when given >1 arg.
      return `MIN(${args.join(', ')})`;
    }
    case 'MAX': {
      if (args.length < 1) {
        throw new Error(`formulaToSql: MAX() requires at least 1 argument`);
      }
      return `MAX(${args.join(', ')})`;
    }
    default: {
      const _never: never = node.name;
      throw new Error(`formulaToSql: unsupported function ${String(_never)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CompiledFormula {
  /** The SQL expression (no surrounding alias, no params). */
  expr: string;
}

/**
 * Build a FieldResolver from a calc field's `dependencies` plus the setup
 * allow-list. Each dependency is expected in `Table.Field` form (matching the
 * report config convention); it is resolved to a qualified column reference.
 *
 * A name used in the formula that is NOT a declared dependency is rejected,
 * even if it would otherwise resolve — this keeps formulas honest about what
 * columns they read (the base-CTE builder relies on `dependencies` to know
 * which columns to SELECT).
 */
function buildDependencyResolver(
  setup: SqlSetup,
  calc: CustomCalcField,
  qualify: (table: string, field: string) => string,
): FieldResolver {
  // Map every accepted spelling of a dependency to its resolved column.
  const map = new Map<string, string>();

  for (const dep of calc.dependencies) {
    const parts = dep.split('.');
    if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') {
      throw new Error(
        `formulaToSql: dependency "${dep}" for calculated field "${calc.field_name}" ` +
          `must be in "Table.Field" form`,
      );
    }
    const [table, field] = parts;
    const col = qualify(table, field);
    // Accept both the full "Table.Field" and the bare "Field" spelling.
    map.set(dep, col);
    if (!map.has(field)) {
      map.set(field, col);
    }
  }

  return (name: string): string => {
    const resolved = map.get(name);
    if (resolved === undefined) {
      throw new Error(
        `formulaToSql: field reference "${name}" in calculated field ` +
          `"${calc.field_name}" is not a declared dependency. ` +
          `Declared: [${calc.dependencies.join(', ')}]`,
      );
    }
    return resolved;
  };
}

/**
 * Compile a `custom_calculated_fields` formula into a SQL expression.
 *
 * @param setup    SQL setup allow-list.
 * @param calc      The calculated-field definition (formula + dependencies).
 * @param qualify   Resolver that turns (table, field) into a qualified,
 *                   quoted column reference — pass `qualifiedColumn` bound to
 *                   the setup, or any resolver that uses the allow-list. The
 *                   base-CTE builder passes its own so the column the calc
 *                   reads is guaranteed to be selected.
 *
 * @returns `{ expr }` — the SQL expression. The base-CTE builder aliases it
 *          as `calculated.<field_name>` via `columnAlias('calculated', name)`.
 */
export function compileFormula(
  setup: SqlSetup,
  calc: CustomCalcField,
  qualify: (table: string, field: string) => string,
): CompiledFormula {
  const raw = (calc.formula ?? '').trim();
  if (raw.length === 0) {
    throw new Error(
      `formulaToSql: calculated field "${calc.field_name}" has an empty formula`,
    );
  }

  // Strip a leading "=" (spreadsheet-style formula prefix).
  const body = raw.startsWith('=') ? raw.slice(1) : raw;

  const resolver = buildDependencyResolver(setup, calc, qualify);

  const tokens = tokenize(body);
  if (tokens.length === 0) {
    throw new Error(
      `formulaToSql: calculated field "${calc.field_name}" produced no tokens`,
    );
  }

  const ast = new Parser(tokens).parse();
  const expr = emit(ast, resolver);

  return { expr };
}

/**
 * Canonical SELECT alias for a calculated field: `"calculated.<field_name>"`.
 * Re-exported helper so builders and the structure adapter agree on the
 * convention without re-deriving it.
 */
export function calculatedAlias(fieldName: string): string {
  return columnAlias('calculated', fieldName);
}
