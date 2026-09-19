/** Safe arithmetic helpers for the amount keypad (no eval). */

const OPERATORS = new Set(["+", "-", "*", "/"]);

export type CalcKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "+"
  | "-"
  | "*"
  | "/"
  | "backspace"
  | "clear"
  | "equals";

function lastNumberSegment(expression: string): string {
  const match = expression.match(/(\d*\.?\d*)$/);
  return match?.[1] ?? "";
}

function endsWithOperator(expression: string): boolean {
  return /[+\-*/]$/.test(expression);
}

/** Tokenize a simple expression into numbers and + - * / operators. */
export function tokenize(expression: string): Array<number | string> | null {
  const src = expression.replace(/\s/g, "");
  if (!src) return null;

  const tokens: Array<number | string> = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (OPERATORS.has(ch)) {
      if (tokens.length === 0 || typeof tokens[tokens.length - 1] === "string") {
        return null;
      }
      tokens.push(ch);
      i += 1;
      continue;
    }

    if (ch >= "0" && ch <= "9" || ch === ".") {
      let j = i;
      let seenDot = false;
      while (j < src.length) {
        const c = src[j];
        if (c === ".") {
          if (seenDot) return null;
          seenDot = true;
          j += 1;
          continue;
        }
        if (c >= "0" && c <= "9") {
          j += 1;
          continue;
        }
        break;
      }
      const raw = src.slice(i, j);
      if (raw === "." || raw === "") return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push(value);
      i = j;
      continue;
    }

    return null;
  }

  return tokens;
}

/** Evaluate tokens with * / before + - (left-associative). */
export function evaluateTokens(tokens: Array<number | string>): number | null {
  if (tokens.length === 0) return null;
  if (typeof tokens[tokens.length - 1] === "string") return null;

  const mulDiv: Array<number | string> = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "*" || token === "/") {
      const left = mulDiv.pop();
      const right = tokens[index + 1];
      if (typeof left !== "number" || typeof right !== "number") return null;
      if (token === "/" && right === 0) return null;
      mulDiv.push(token === "*" ? left * right : left / right);
      index += 2;
      continue;
    }
    mulDiv.push(token);
    index += 1;
  }

  let result = mulDiv[0];
  if (typeof result !== "number") return null;
  for (let i = 1; i < mulDiv.length; i += 2) {
    const op = mulDiv[i];
    const right = mulDiv[i + 1];
    if (typeof op !== "string" || typeof right !== "number") return null;
    if (op === "+") result += right;
    else if (op === "-") result -= right;
    else return null;
  }

  return Number.isFinite(result) ? result : null;
}

/**
 * Evaluate a full expression. Trailing operators are ignored for live preview
 * so `100+` still shows `100`.
 */
export function evaluateExpression(expression: string): number | null {
  let src = expression.replace(/\s/g, "");
  if (!src) return null;
  while (endsWithOperator(src)) {
    src = src.slice(0, -1);
  }
  if (!src) return null;
  const tokens = tokenize(src);
  if (!tokens) return null;
  return evaluateTokens(tokens);
}

/** Format a number for the expression display (trim trailing zeros). */
export function formatCalcNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1e8) / 1e8;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

export function appendDigit(expression: string, digit: string): string {
  if (!/^\d$/.test(digit)) return expression;
  const segment = lastNumberSegment(expression);
  // Replace a bare "0" so "05" becomes "5"
  if (segment === "0") {
    return expression.slice(0, -1) + digit;
  }
  return expression + digit;
}

export function appendDecimal(expression: string): string {
  if (!expression || endsWithOperator(expression)) {
    return expression + "0.";
  }
  const segment = lastNumberSegment(expression);
  if (segment.includes(".")) return expression;
  if (!segment) return expression + "0.";
  return expression + ".";
}

export function appendOperator(expression: string, op: string): string {
  if (!OPERATORS.has(op)) return expression;
  if (!expression) return "";
  if (endsWithOperator(expression)) {
    return expression.slice(0, -1) + op;
  }
  if (expression.endsWith(".")) {
    return expression.slice(0, -1) + op;
  }
  return expression + op;
}

export function backspaceExpression(expression: string): string {
  return expression.slice(0, -1);
}

export function applyEquals(expression: string): string {
  const result = evaluateExpression(expression);
  if (result === null) return expression;
  return formatCalcNumber(result);
}

export function applyKey(expression: string, key: CalcKey): string {
  switch (key) {
    case "clear":
      return "";
    case "backspace":
      return backspaceExpression(expression);
    case "equals":
      return applyEquals(expression);
    case ".":
      return appendDecimal(expression);
    case "+":
    case "-":
    case "*":
    case "/":
      return appendOperator(expression, key);
    default:
      return appendDigit(expression, key);
  }
}

/** Non-negative amount suitable for a transaction (or null if invalid). Zero is allowed (e.g. treated meals). */
export function toAmountValue(expression: string): number | null {
  const src = expression.replace(/\s/g, "");
  if (!src || endsWithOperator(src)) return null;
  const result = evaluateExpression(src);
  if (result === null) return null;
  const abs = Math.abs(result);
  if (!Number.isFinite(abs) || abs < 0) return null;
  return abs;
}
