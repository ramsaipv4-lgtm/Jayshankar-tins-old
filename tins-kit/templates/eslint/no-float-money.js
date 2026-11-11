// templates/eslint/no-float-money.js
//
// The ESLint rule that bans `Number()` and `parseFloat()` on money fields.
// Copy this file to your consumer's `.eslint-rules/no-float-money.js` (or
// wherever custom rules live) and add it to `.eslintrc`.
//
// THE CONTRACT:
//   - Any expression that calls `Number(...)` or `parseFloat(...)` on a
//     variable/field whose name ends in `Amount`, `Price`, `Cost`, `Fee`,
//     `Total`, `Subtotal`, `Tax`, `Discount`, `Balance`, or `TrancheSize`
//     is an ERROR.
//   - The error message tells the developer exactly what to use instead
//     (`Prisma.Decimal` + the kit's `lib/money-as-decimal` module).
//
// Source: atal-incubation (the "Money is Decimal, never Float" rule #5 in
// AGENTS.md), Jayshankar (D7 in BUILDER-DECISIONS-REVIEW.md).

'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Number() and parseFloat() on money fields. Use Prisma.Decimal and the money-as-decimal kit module instead.',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noFloat:
        'Do not use {{fn}}() on money field "{{name}}". Use `new Prisma.Decimal({{name}})` or the kit\'s `lib/money-as-decimal` module. See tins-kit/lib/patterns/money-as-decimal.',
    },
  },

  create(context) {
    // The suffixes that indicate a money field. Extend as needed for your
    // consumer's domain (e.g. add 'Salary', 'Rent', 'InvoiceAmount').
    const MONEY_SUFFIXES = [
      'Amount',
      'Price',
      'Cost',
      'Fee',
      'Total',
      'Subtotal',
      'Tax',
      'Discount',
      'Balance',
      'TrancheSize',
      'GrantSize',
      'InvoiceTotal',
      'Payout',
    ];

    // The forbidden functions.
    const FORBIDDEN_FNS = new Set(['Number', 'parseFloat']);

    function isMoneyField(name) {
      if (typeof name !== 'string') return false;
      return MONEY_SUFFIXES.some((suffix) => name.endsWith(suffix));
    }

    return {
      CallExpression(node) {
        // Match `Number(x)` or `parseFloat(x)` calls.
        if (
          node.callee.type === 'Identifier' &&
          FORBIDDEN_FNS.has(node.callee.name)
        ) {
          // The first argument is the suspect expression. We try to extract
          // a name from it (MemberExpression for `obj.amount` or
          // Identifier for `amount`).
          const arg = node.arguments[0];
          if (!arg) return;

          let name = null;
          if (arg.type === 'Identifier') {
            name = arg.name;
          } else if (
            arg.type === 'MemberExpression' &&
            arg.property.type === 'Identifier'
          ) {
            name = arg.property.name;
          } else if (
            arg.type === 'MemberExpression' &&
            arg.property.type === 'Literal' &&
            typeof arg.property.value === 'string'
          ) {
            name = arg.property.value;
          }

          if (name && isMoneyField(name)) {
            context.report({
              node,
              messageId: 'noFloat',
              data: { fn: node.callee.name, name },
            });
          }
        }
      },
    };
  },
};
